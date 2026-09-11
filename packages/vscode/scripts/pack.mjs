import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const extensionDirectory = fileURLToPath(new URL("../", import.meta.url));
const repository = path.resolve(extensionDirectory, "../..");
const require = createRequire(path.join(extensionDirectory, "package.json"));
const manifest = JSON.parse(
  fs.readFileSync(path.join(extensionDirectory, "package.json"), "utf8"),
);

// This script is started by pnpm, and re-uses that same pnpm for the build and
// the deployment below, so no global installation is required.
const pnpm = process.env.npm_execpath;
if (!pnpm || !/pnpm\.(?:c|m)?js$/.test(pnpm)) {
  throw new Error("Run this script with pnpm run pack.");
}

// vsce names targets with VS Code's own platform strings, while the optional
// native dependency is an npm platform package keyed by Node's names.
const target = `${process.platform}-${process.arch === "arm" ? "armhf" : process.arch}`;
const nativePlatformPackage = `@typescript-native-bridge/${process.platform}-${process.arch}`;

// The deployment is built and packaged outside the repository, so a pack never
// writes inside the checkout. The VSIX lands in the same directory unless the
// caller names one, and `GTS_VSCODE_PACK_TMPDIR` moves both when a caller wants
// to inspect the deployment afterwards.
const configuredTemporaryRoot = process.env.GTS_VSCODE_PACK_TMPDIR;
const temporaryRoot = path.resolve(
  configuredTemporaryRoot ??
    fs.mkdtempSync(path.join(os.tmpdir(), "gts-vscode-pack-")),
);
fs.mkdirSync(temporaryRoot, { recursive: true });
const output = path.resolve(
  process.argv[2] ??
    path.join(
      temporaryRoot,
      `${manifest.name}-${manifest.version}-${target}.vsix`,
    ),
);
if (fs.existsSync(output)) {
  throw new Error(`Output already exists: ${output}`);
}
fs.mkdirSync(path.dirname(output), { recursive: true });
const stage = fs.mkdtempSync(path.join(temporaryRoot, "vsix-"));

const sha256 = (file) =>
  createHash("sha256").update(fs.readFileSync(file)).digest("hex");

// Containment by `path.relative`: the directory itself counts as inside, which
// the deployed-tree walk below needs, because the hoisted packages are its own
// `node_modules`. Every deletion in this script goes through this check first.
const inside = (directory, file) => {
  const relative = path.relative(directory, file);
  return !relative.startsWith("..") && !path.isAbsolute(relative);
};

function removeAllocated(directory) {
  if (!fs.existsSync(directory)) return;
  assert.ok(
    inside(fs.realpathSync(temporaryRoot), fs.realpathSync(directory)),
    `Refusing to remove ${directory}: it is not inside ${temporaryRoot}`,
  );
  fs.rmSync(directory, { recursive: true, maxRetries: 3, retryDelay: 100 });
}

function run(entry, args, cwd) {
  const result = spawnSync(process.execPath, [entry, ...args], {
    cwd,
    stdio: "inherit",
    windowsHide: true,
  });
  if (result.error) throw result.error;
  if (result.status !== 0 || result.signal) {
    throw new Error(
      `Command failed in ${cwd}: ${entry} ${args.join(" ")} (${result.status ?? result.signal})`,
    );
  }
}

const pnpmRun = (...args) => run(pnpm, args, repository);

const workspaceSpecifier = /^(?:workspace|catalog):/;

// How `pnpm publish` rewrites a workspace-only specifier: to the installed
// copy's own version, or to an npm alias when its directory name is not its
// package name.
const resolvedSpecifier = (name, installed) =>
  name === installed.name
    ? installed.version
    : `npm:${installed.name}@${installed.version}`;

// Node's resolution walk, restricted to the deployment: the package's own
// `node_modules` first, then every ancestor's.
function installedManifest(manifestFile, name) {
  for (
    let directory = path.dirname(manifestFile);
    inside(stage, directory);
    directory = path.dirname(directory)
  ) {
    if (path.basename(directory) === "node_modules") continue;
    const file = path.join(
      directory,
      "node_modules",
      ...name.split("/"),
      "package.json",
    );
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, "utf8"));
  }
  return null;
}

function deployedManifestFiles(directory) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...deployedManifestFiles(file));
    else if (entry.name === "package.json") files.push(file);
  }
  return files;
}

// pnpm keeps its workspace-only specifiers in the manifests it deploys, and
// `vsce` reads the deployment with `npm list`, which cannot resolve them: it
// stops at ELSPROBLEMS and no VSIX is written. Rewrite them the way `pnpm
// publish` rewrites them for the released packages. The deployment is a frozen,
// fully installed tree, so the installed copy is the resolved answer, and a
// dependency it does not contain cannot be packaged at all. `devDependencies`
// are left alone: npm does not validate those of a deployed package, and the
// deployment deliberately does not carry them.
function resolveDeployedSpecifiers() {
  const unresolved = [];
  for (const file of deployedManifestFiles(path.join(stage, "node_modules"))) {
    const deployedManifest = JSON.parse(fs.readFileSync(file, "utf8"));
    let rewritten = false;
    for (const field of [
      "dependencies",
      "optionalDependencies",
      "peerDependencies",
    ]) {
      for (const [name, specifier] of Object.entries(
        deployedManifest[field] ?? {},
      )) {
        if (!workspaceSpecifier.test(specifier)) continue;
        const dependency = installedManifest(file, name);
        if (!dependency) {
          unresolved.push(
            `${deployedManifest.name} needs ${name}@${specifier} (${field})`,
          );
          continue;
        }
        deployedManifest[field][name] = resolvedSpecifier(name, dependency);
        rewritten = true;
      }
    }
    if (!rewritten) continue;
    // Write through a rename: `inject-workspace-packages` hard-links the
    // deployed packages, and for a workspace package those links reach the
    // workspace's own files, so rewriting in place would edit the repository
    // instead of the deployment.
    const resolved = `${file}.resolved`;
    fs.writeFileSync(
      resolved,
      JSON.stringify(deployedManifest, null, 2) + "\n",
    );
    fs.renameSync(resolved, file);
  }
  assert.ok(
    unresolved.length === 0,
    `The deployment does not contain every dependency it declares:\n  ${unresolved.join("\n  ")}`,
  );
}

try {
  pnpmRun("--filter", "gamingts-vscode...", "build");
  // Deploy from the lockfile instead of reinstalling the published dependencies
  // with npm: the deployment keeps the pnpm patches and instantiates the
  // workspace packages, and it leaves the source workspace's own installation
  // settings untouched.
  pnpmRun(
    "--filter",
    "gamingts-vscode",
    "--config.inject-workspace-packages=true",
    "deploy",
    "--prod",
    stage,
  );

  // The extension bundles the workspace packages into its own `dist`, so the
  // deployment only carries the artifacts that stay separate at runtime: the
  // SDK, the Volar host hook it resolves through, and the language service
  // plugins that VS Code loads into the built-in TypeScript extension. The
  // `@gi-tcg` packages are not dependencies of the extension, so each one is
  // compared through the package that does depend on it.
  const deployedArtifacts = [
    // specifier, the package that resolves it, in the repository and in the
    // deployment
    ["typescript/lib/typescript.js", extensionDirectory, stage],
    [
      "@volar/typescript/lib/node/proxyCreateProgram.js",
      extensionDirectory,
      stage,
    ],
    [
      "@gi-tcg/gts-typescript-language-service-plugin",
      extensionDirectory,
      stage,
    ],
    [
      "@gi-tcg/gts-language-plugin",
      path.join(repository, "packages/typescript-language-service-plugin"),
      path.join(
        stage,
        "node_modules/@gi-tcg/gts-typescript-language-service-plugin",
      ),
    ],
    [
      "@gi-tcg/gts-transpiler",
      path.join(repository, "packages/language-plugin"),
      path.join(stage, "node_modules/@gi-tcg/gts-language-plugin"),
    ],
  ];
  for (const [specifier, fromRepository, fromDeployment] of deployedArtifacts) {
    const resolve = (directory) =>
      createRequire(path.join(directory, "package.json")).resolve(specifier);
    assert.equal(
      sha256(resolve(fromDeployment)),
      sha256(resolve(fromRepository)),
      `Deployment changed the tested artifact ${specifier}`,
    );
  }
  const deployedRequire = createRequire(path.join(stage, "package.json"));
  const addonOf = (sdkRequire) =>
    path.join(
      path.dirname(sdkRequire.resolve(`${nativePlatformPackage}/package.json`)),
      "native/bridge.node",
    );
  assert.equal(
    sha256(
      addonOf(
        createRequire(deployedRequire.resolve("typescript/package.json")),
      ),
    ),
    sha256(addonOf(createRequire(require.resolve("typescript/package.json")))),
    "Deployment changed the native addon",
  );

  resolveDeployedSpecifiers();

  // The deployment manifest can hold workspace file URLs and pnpm patch
  // suffixes. VS Code needs ordinary package metadata, not install paths.
  const packagedManifest = { ...manifest };
  delete packagedManifest.devDependencies;
  for (const field of ["dependencies", "optionalDependencies"]) {
    if (!manifest[field]) continue;
    packagedManifest[field] = Object.fromEntries(
      Object.keys(manifest[field]).map((name) => {
        const dependency = JSON.parse(
          fs.readFileSync(require.resolve(`${name}/package.json`), "utf8"),
        );
        return [name, resolvedSpecifier(name, dependency)];
      }),
    );
  }
  fs.writeFileSync(
    path.join(stage, "package.json"),
    JSON.stringify(packagedManifest, null, 2) + "\n",
  );

  const vsce = path.join(
    path.dirname(require.resolve("vsce/package.json")),
    "vsce",
  );
  run(vsce, ["package", "--target", target, "--out", output], stage);
  console.log(`Packaged ${output}\nSHA256 ${sha256(output)}`);
} finally {
  // Only ever remove the directories this run allocated itself, and never the
  // one holding the VSIX that was asked for. A directory named by
  // `GTS_VSCODE_PACK_TMPDIR` belongs to the caller.
  removeAllocated(stage);
  if (!configuredTemporaryRoot && !inside(temporaryRoot, output)) {
    removeAllocated(temporaryRoot);
  }
}
