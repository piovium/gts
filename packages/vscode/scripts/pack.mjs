import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";

const extensionDirectory = fileURLToPath(new URL("../", import.meta.url));
const repository = path.resolve(extensionDirectory, "../..");
const require = createRequire(path.join(extensionDirectory, "package.json"));
const manifest = JSON.parse(
  fs.readFileSync(path.join(extensionDirectory, "package.json"), "utf8"),
);
const pnpm = process.env.npm_execpath;
if (!pnpm || !/pnpm\.(?:c|m)?js$/.test(pnpm))
  throw new Error("Run this script with pnpm run pack.");
const target = `${process.platform}-${process.arch === "arm" ? "armhf" : process.arch}`;
const temporaryRoot = path.join(extensionDirectory, "temp");
fs.mkdirSync(temporaryRoot, { recursive: true });
const output = path.resolve(
  process.argv[2] ??
    path.join(
      temporaryRoot,
      `${manifest.name}-${manifest.version}-${target}.vsix`,
    ),
);
if (fs.existsSync(output)) throw new Error(`Output already exists: ${output}`);
fs.mkdirSync(path.dirname(output), { recursive: true });
const stage = fs.mkdtempSync(path.join(temporaryRoot, "vsix-"));
const hash = (file) =>
  createHash("sha256").update(fs.readFileSync(file)).digest("hex");
function run(entry, args, cwd) {
  const result = spawnSync(process.execPath, [entry, ...args], {
    cwd,
    stdio: "inherit",
    windowsHide: true,
  });
  if (result.error) throw result.error;
  if (result.status !== 0 || result.signal)
    throw new Error(
      `Command failed: ${entry} ${args.join(" ")} (${result.status ?? result.signal})`,
    );
}
try {
  run(pnpm, ["--filter", "gamingts-vscode...", "build"], repository);
  // Use pnpm's lockfile deployment rather than reinstalling public dependencies
  // with npm. The deployment alone injects the existing workspace packages;
  // the source workspace's installation settings are unchanged.
  run(
    pnpm,
    [
      "--filter",
      "gamingts-vscode",
      "--config.inject-workspace-packages=true",
      "deploy",
      "--prod",
      stage,
    ],
    repository,
  );
  const deployedRequire = createRequire(path.join(stage, "package.json"));
  for (const module of [
    "typescript/lib/typescript.js",
    "@volar/typescript/lib/node/proxyCreateProgram.js",
    "@gi-tcg/gts-typescript-language-service-plugin",
    "@gi-tcg/gts-language-plugin",
    "@gi-tcg/gts-transpiler",
  ]) {
    assert.equal(
      hash(deployedRequire.resolve(module)),
      hash(require.resolve(module)),
      `Deployment changed the tested artifact ${module}`,
    );
  }
  const platformPackage = `@typescript-native-bridge/${process.platform}-${process.arch}`;
  const originalSdkRequire = createRequire(
    require.resolve("typescript/package.json"),
  );
  const deployedSdkRequire = createRequire(
    deployedRequire.resolve("typescript/package.json"),
  );
  const addon = (context) =>
    path.join(
      path.dirname(context.resolve(`${platformPackage}/package.json`)),
      "native/bridge.node",
    );
  assert.equal(
    hash(addon(deployedSdkRequire)),
    hash(addon(originalSdkRequire)),
    "Deployment changed the native addon",
  );

  // Deployment's install manifest can contain workspace file URLs and pnpm
  // patch suffixes. VS Code needs normal package metadata, not install paths.
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
  console.log(`Packaged ${output}\nSHA256 ${hash(output)}`);
} finally {
  // Only remove the newly allocated directory, never an existing user's temp.
  if (fs.existsSync(stage)) {
    const relative = path.relative(
      fs.realpathSync(temporaryRoot),
      fs.realpathSync(stage),
    );
    assert.ok(
      relative && !relative.startsWith("..") && !path.isAbsolute(relative),
    );
    fs.rmSync(stage, { recursive: true, maxRetries: 3, retryDelay: 100 });
  }
}
