import fs from "node:fs";
import path from "node:path";
import { expect, test } from "vitest";
import {
  createTsserverProxyText,
  isTsserverFile,
  patchTypeScriptSource,
} from "../src/tsserver_proxy.ts";

test("patches the installed TypeScript source for .gts files", () => {
  const wrapperPath = require.resolve("typescript/lib/typescript.js");
  const typescriptPath = require.resolve("typescript", {
    paths: [path.dirname(wrapperPath)],
  });
  const source = fs.readFileSync(typescriptPath, "utf8");
  const patched = patchTypeScriptSource(source);

  expect(patched).toMatch(
    /supportedTSExtensions = .*\.concat\(\["\.gts"\]\)/,
  );
  expect(patched).toMatch(
    /supportedJSExtensions = .*\.concat\(\["\.gts"\]\)/,
  );
  expect(patched).toMatch(
    /allSupportedExtensions = .*\.concat\(\["\.gts"\]\)/,
  );
  expect(patched).toContain(
    'return [".gts"].some(ext => path.endsWith(ext))',
  );
});

test("rejects an unsupported TypeScript source shape", () => {
  expect(() => patchTypeScriptSource("module.exports = {};")).toThrow(
    "supportedTSExtensions was not found",
  );
});

test("keeps opened GTS files out of Native Bridge configured projects", () => {
  const source = `
function createTsgoProgram(rootNames, options) {}
class ProjectService {
  getConfigFileNameForFile(info, findFromCacheOnly) {
    return "tsconfig.json";
  }
}`;

  const patched = patchTypeScriptSource(source);

  expect(patched).toContain(
    'if (info.fileName.toLowerCase().endsWith(".gts")) return void 0;',
  );
  expect(patched).not.toContain('concat([".gts"])');
});

test("creates a proxy for the selected tsserver", () => {
  const serverPath = "/workspace/node_modules/typescript/lib/tsserver.js";
  const typescriptPath =
    "/workspace/node_modules/typescript/lib/typescript.js";
  const proxy = createTsserverProxyText(serverPath, typescriptPath);

  expect(proxy).toContain(JSON.stringify(serverPath));
  expect(proxy).toContain(JSON.stringify(typescriptPath));
  expect(proxy).toContain("patchTypeScriptSource");
});

test("only recognizes absolute tsserver entry points", () => {
  expect(
    isTsserverFile(path.resolve("node_modules/typescript/lib/tsserver.js")),
  ).toBe(true);
  expect(isTsserverFile("node_modules/typescript/lib/tsserver.js")).toBe(
    false,
  );
  expect(isTsserverFile(path.resolve("typescript.js"))).toBe(false);
});
