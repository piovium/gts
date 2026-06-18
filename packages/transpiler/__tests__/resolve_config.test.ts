import { test, expect } from "vitest";
import path from "node:path";
import win32Path from "node:path/win32";
import {
  resolveGtsConfig,
  resolveGtsConfigSync,
  type GtsConfig,
} from "../src/config.ts";

const PACKAGE_JSON = JSON.stringify({
  gamingTs: {
    runtimeImportSource: "test-runtime",
  } satisfies GtsConfig,
});

const REPO_ROOT = path.resolve("/repo");
const PACKAGE_PATH = path.join(REPO_ROOT, "package.json");

test("resolveGtsConfigSync prefers package config", () => {
  const resolved = resolveGtsConfigSync(
    "src/file.gts",
    {},
    {
      cwd: REPO_ROOT,
      readFileFn: (p, encoding) => {
        if (path.resolve(p) !== PACKAGE_PATH) {
          throw new Error(`EEXISTS`);
        }
        expect(encoding).toBe("utf8");
        return PACKAGE_JSON;
      },
    },
  );
  expect(resolved.runtimeImportSource).toBe("test-runtime");
});

test("resolveGtsConfig resolves async read file", async () => {
  const resolved = await resolveGtsConfig(
    "src/file.gts",
    {},
    {
      cwd: REPO_ROOT,
      readFileFn: async (p, encoding) => {
        if (path.resolve(p) !== PACKAGE_PATH) {
          throw new Error(`EEXISTS`);
        }
        expect(encoding).toBe("utf8");
        return PACKAGE_JSON;
      },
    },
  );
  expect(resolved.runtimeImportSource).toBe("test-runtime");
});

test("resolveGtsConfigSync handles Windows backslash paths with cwd", () => {
  const resolved = resolveGtsConfigSync(
    "src\\file.gts",
    {},
    {
      cwd: "C:\\repo",
      pathModule: win32Path,
      readFileFn: (p, encoding) => {
        if (win32Path.resolve(p) !== "C:\\repo\\package.json") {
          throw new Error(`EEXISTS`);
        }
        expect(encoding).toBe("utf8");
        return PACKAGE_JSON;
      },
    },
  );
  expect(resolved.runtimeImportSource).toBe("test-runtime");
});
