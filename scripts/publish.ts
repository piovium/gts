import { $ } from "bun";

const PACKAGES = [
  "transpiler",
  "runtime",
  "esbuild-plugin",
  "rollup-plugin",
  "language-plugin",
  "language-server",
  "tsc",
  "typescript-language-service-plugin",
];

const VERSION = "0.3.0";
import { repository as REPOSITORY, license as LICENSE } from "../package.json";

for (const pkg of PACKAGES) {
  const { version, repository, license } = await import(`../packages/${pkg}/package.json`, {
    with: { type: "json" },
  });
  if (version !== VERSION) {
    throw new Error(
      `Version mismatch for package ${pkg}: expected ${VERSION}, got ${version}`,
    );
  }
  if (repository !== REPOSITORY) {
    throw new Error(
      `Repository mismatch for package ${pkg}: expected ${REPOSITORY}, got ${repository}`,
    );
  }
  if (license !== LICENSE) {
    throw new Error(
      `License mismatch for package ${pkg}: expected ${LICENSE}, got ${license}`,
    );
  }
  await $`bun publish --access public ${process.argv.slice(2)}`.cwd(`packages/${pkg}`);
}
