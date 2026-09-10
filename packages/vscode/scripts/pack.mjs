import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import { createRequire } from "node:module";
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

const temporaryRoot = path.join(extensionDirectory, "temp");
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
  // plugin that VS Code loads into the built-in TypeScript extension.
  // `@gi-tcg/gts-language-plugin` and `@gi-tcg/gts-transpiler` are also deployed
  // and were checked here before, but neither is resolvable from the extension
  // root (they are not its dependencies). Add them back resolved from
  // `node_modules/@gi-tcg/gts-typescript-language-service-plugin` once packaging
  // itself runs again.
  const deployedArtifacts = [
    "typescript/lib/typescript.js",
    "@volar/typescript/lib/node/proxyCreateProgram.js",
    "@gi-tcg/gts-typescript-language-service-plugin",
  ];
  const deployedRequire = createRequire(path.join(stage, "package.json"));
  for (const specifier of deployedArtifacts) {
    assert.equal(
      sha256(deployedRequire.resolve(specifier)),
      sha256(require.resolve(specifier)),
      `Deployment changed the tested artifact ${specifier}`,
    );
  }
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
        return [
          name,
          name === dependency.name
            ? dependency.version
            : `npm:${dependency.name}@${dependency.version}`,
        ];
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
  // Only ever remove the directory this run just allocated.
  if (fs.existsSync(stage)) {
    const relative = path.relative(
      fs.realpathSync(temporaryRoot),
      fs.realpathSync(stage),
    );
    assert.ok(
      relative && !relative.startsWith("..") && !path.isAbsolute(relative),
      `Refusing to remove ${stage}: it is not inside ${temporaryRoot}`,
    );
    fs.rmSync(stage, { recursive: true, maxRetries: 3, retryDelay: 100 });
  }
}
