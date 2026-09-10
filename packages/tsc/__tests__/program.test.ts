import { unlinkSync, readFileSync } from "node:fs";
import path from "node:path";
import { createLanguage, FileMap } from "@volar/language-core";
import { proxyCreateProgram } from "@volar/typescript/lib/node/proxyCreateProgram.js";
import {
  createGtsLanguagePlugin,
  createTnbGetSourceText,
  type TnbTextHost,
} from "@gi-tcg/gts-language-plugin";
import ts from "typescript";
import { expect, test } from "vitest";
import {
  character,
  createFixture,
  fixtureSources,
} from "../../language-server/__tests__/fixture.ts";
import { createGtscProject } from "../src/project.ts";

test("native GTS text host avoids a JavaScript parse and refreshes changed, deleted and recreated files", () => {
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
    const host = ts.createCompilerHost(options) as TnbTextHost;
    let sourceFileCalls = 0;
    const originalGetSourceFile = host.getSourceFile;
    host.getSourceFile = (
      ...args: Parameters<typeof originalGetSourceFile>
    ) => {
      sourceFileCalls++;
      return Reflect.apply(originalGetSourceFile, host, args);
    };
    // Build the program the way `gtsc` does, so this covers the entry point's
    // own wiring too: the host created above carries no text hook until that
    // descriptor installs one.
    const createProgram = proxyCreateProgram(
      ts,
      ts.createProgram,
      createGtscProject,
    );
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
      // Enumerating the whole program must not materialize a JS AST either.
      expect(program.getSourceFiles().length).toBeGreaterThan(rootNames.length);
      expect(sourceFileCalls).toBe(0);
      return diagnostics;
    };
    // Exact (code, file) inventory, so an extra or missing diagnostic fails.
    // A diagnostic with no source file is marked `<program>`; the "file not
    // found" error of a deleted root file reaches the list that way.
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

test("the text-only host hook serves GTS virtual text without a JavaScript parse", () => {
  const fixture = createFixture();
  try {
    const sourceFile = path.join(fixture.directory, "current.gts");
    const source = readFileSync(sourceFile, "utf8");
    const language = createLanguage(
      [createGtsLanguagePlugin(ts, { pathModule: path })],
      new FileMap(ts.sys.useCaseSensitiveFileNames),
      () => {},
    );
    language.scripts.set(sourceFile, {
      getText: (start, end) => source.slice(start, end),
      getLength: () => source.length,
      getChangeRange: () => undefined,
    });
    const getSourceText = createTnbGetSourceText(
      ts,
      ts.createCompilerHost({}),
      language,
    );
    const root = language.scripts.get(sourceFile)!.generated!.root;
    const virtualText = root.snapshot.getText(0, root.snapshot.getLength());
    expect(getSourceText(sourceFile)).toEqual({
      // The hook prepends the source blanked to the same length, so the virtual
      // text after it keeps the offsets Volar maps from.
      text:
        source
          .split("\n")
          .map((line) => " ".repeat(line.length))
          .join("\n") + virtualText,
      scriptKind: ts.ScriptKind.TS,
    });
    // The served text is transpiled: no GTS syntax survives.
    expect(getSourceText(sourceFile)?.text).not.toContain("define character {");
    const plainFile = path.join(fixture.directory, "consumer.ts");
    expect(getSourceText(plainFile)).toEqual({
      text: readFileSync(plainFile, "utf8"),
      scriptKind: ts.ScriptKind.TS,
    });
    expect(
      getSourceText(path.join(fixture.directory, "missing.ts")),
    ).toBeUndefined();
  } finally {
    fixture.dispose();
  }
});
