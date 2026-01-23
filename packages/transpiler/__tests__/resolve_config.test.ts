import { test, expect } from "bun:test";
import path from "node:path";
import {
  resolveGtsConfig,
  resolveGtsConfigSync,
  type GtsConfig,
} from "../src/config";

const PACKAGE_JSON = JSON.stringify({
  gamingTs: {
    runtimeImportSource: "test-runtime",
  } satisfies GtsConfig,
});

const REPO_ROOT = path.resolve("/repo");
const PACKAGE_PATH = path.join(REPO_ROOT, "package.json");

test("resolveGtsConfigSync prefers package config", () => {
  const resolved = resolveGtsConfigSync("src/file.gts", {}, {
    cwd: REPO_ROOT,
    readFileFn: (p, encoding) => {
      if (p !== PACKAGE_PATH) {
        return JSON.stringify({});
      }
      expect(encoding).toBe("utf-8");
      return PACKAGE_JSON;
    },
  });
  expect(resolved.runtimeImportSource).toBe("test-runtime");
});

test("resolveGtsConfig resolves async read file", async () => {
  const resolved = await resolveGtsConfig("src/file.gts", {}, {
    cwd: REPO_ROOT,
    readFileFn: async (p, encoding) => {
      if (p !== PACKAGE_PATH) {
        return JSON.stringify({});
      }
      expect(encoding).toBe("utf-8");
      return PACKAGE_JSON;
    },
  });
  expect(resolved.runtimeImportSource).toBe("test-runtime");
});
