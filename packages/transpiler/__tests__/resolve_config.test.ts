import { test, expect } from "bun:test";
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

test("resolveGtsConfigSync prefers package config", () => {
  const resolved = resolveGtsConfigSync("src/file.gts", {}, {
    cwd: "/repo",
    readFileFn: (path, encoding) => {
      if (path !== "/repo/package.json") {
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
    cwd: "/repo",
    readFileFn: async (path, encoding) => {
      if (path !== "/repo/package.json") {
        return JSON.stringify({});
      }
      expect(encoding).toBe("utf-8");
      return PACKAGE_JSON;
    },
  });
  expect(resolved.runtimeImportSource).toBe("test-runtime");
});
