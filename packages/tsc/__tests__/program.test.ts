import { unlinkSync, readFileSync } from "node:fs";
import path from "node:path";
import { proxyCreateProgram } from "@volar/typescript/lib/node/proxyCreateProgram.js";
import { createGtsLanguagePlugin } from "@gi-tcg/gts-language-plugin";
import ts from "typescript";
import { expect, test } from "vitest";
import {
  character,
  createFixture,
  fixtureSources,
} from "../../language-server/__tests__/fixture.ts";

test("native GTS text host avoids JS parsing and refreshes changed, deleted and recreated files", () => {
  const fixture = createFixture();
  try {
    const configFilePath = path.join(fixture.directory, "tsconfig.json");
    const config = ts.parseJsonConfigFileContent(
      JSON.parse(readFileSync(configFilePath, "utf8")),
      ts.sys,
      fixture.directory,
    );
    const options = { ...config.options, configFilePath };
    const rootNames = Object.keys(fixtureSources).map((file) =>
      path.join(fixture.directory, file),
    );
    const host = ts.createCompilerHost(options);
    let sourceFileCalls = 0;
    const originalGetSourceFile = host.getSourceFile;
    host.getSourceFile = (
      ...args: Parameters<typeof originalGetSourceFile>
    ) => {
      sourceFileCalls++;
      return Reflect.apply(originalGetSourceFile, host, args);
    };
    const createProgram = proxyCreateProgram(ts, ts.createProgram, () => ({
      languagePlugins: [createGtsLanguagePlugin(ts, { pathModule: path })],
    }));
    const check = () => {
      const program = createProgram({ rootNames, options, host });
      const diagnostics = ts.getPreEmitDiagnostics(program).map((item) => ({
        code: item.code,
        file: item.file && path.basename(item.file.fileName),
        position:
          item.file && item.start !== undefined
            ? item.file.getLineAndCharacterOfPosition(item.start)
            : undefined,
      }));
      // Whole-program inventory must also avoid materializing every JS AST.
      expect(program.getSourceFiles().length).toBeGreaterThan(rootNames.length);
      expect(sourceFileCalls).toBe(0);
      return diagnostics;
    };
    // Exact (code, file) inventory, so an extra or missing diagnostic fails.
    // Diagnostics without a source file (program-wide) are marked explicitly:
    // "file not found" for a deleted root file carries no file identity.
    const identity = () =>
      check()
        .map((item) => `${item.code} ${item.file ?? "<program>"}`)
        .sort();
    expect(check()).toEqual([]);
    fixture.write(
      "current.gts",
      character.replace("health 10", 'health "bad"'),
    );
    expect(check()).toEqual([
      { code: 2345, file: "current.gts", position: { line: 5, character: 9 } },
    ]);
    fixture.write("current.gts", character);
    expect(check()).toEqual([]);
    fixture.write(
      "current.gts",
      character.replace("shared: number = 1201", 'shared: string = "changed"'),
    );
    expect(identity()).toEqual(["2322 component.tsx", "2322 consumer.ts"]);
    fixture.write("current.gts", character);
    expect(check()).toEqual([]);
    unlinkSync(path.join(fixture.directory, "isolated.gts"));
    expect(identity()).toEqual(["6053 <program>"]);
    fixture.write(
      "isolated.gts",
      character
        .replaceAll("Barbara", "Unreferenced")
        .replace("health 10", 'health "bad"'),
    );
    expect(check()).toEqual([
      { code: 2345, file: "isolated.gts", position: { line: 5, character: 9 } },
    ]);
    fixture.write(
      "isolated.gts",
      character.replaceAll("Barbara", "Unreferenced"),
    );
    expect(check()).toEqual([]);
  } finally {
    fixture.dispose();
  }
}, 60000);
