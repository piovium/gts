/// <reference types="node" />

import { describe, expect, test } from "vitest";
import ts from "typescript";
import { SourceMap } from "@volar/language-core";
import { readFileSync } from "node:fs";
import path from "node:path";
import { transpileForVolar } from "../src/index.ts";

const provider = readFileSync(
  new URL("./fixtures/typing_provider.ts", import.meta.url),
  "utf8",
);
const assertions = `
  type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends
    (<T>() => T extends B ? 1 : 2) ? true : false;
  type Assert<T extends true> = T;
`;

function check(source: string, typeCheckingOnly: boolean) {
  const filename = path.resolve("/virtual/typing.gts.ts");
  const providerFilename = path.resolve("/virtual/provider.ts");
  const result = transpileForVolar(source, filename, {
    providerImportSource: "provider",
    runtimeImportSource: "provider",
    typeCheckingOnly,
  });
  const options: ts.CompilerOptions = {
    strict: true,
    erasableSyntaxOnly: true,
    noEmit: true,
    types: [],
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    skipLibCheck: true,
  };
  const host = ts.createCompilerHost(options);
  const original = host.getSourceFile.bind(host);
  host.getSourceFile = (name, languageVersion, onError, createNew) => {
    if (name === filename || name === providerFilename) {
      return ts.createSourceFile(
        name,
        name === filename ? result.code : provider,
        languageVersion,
        true,
      );
    }
    return original(name, languageVersion, onError, createNew);
  };
  host.resolveModuleNames = (names) =>
    names.map(() => ({
      resolvedFileName: providerFilename,
      extension: ts.Extension.Ts,
    }));
  const program = ts.createProgram([filename], options, host);
  const diagnostics = ts.getPreEmitDiagnostics(program);
  const map = new SourceMap(result.mappings);
  const mapped = diagnostics.flatMap((diagnostic) => {
    if (
      diagnostic.file?.fileName !== filename ||
      diagnostic.start === undefined
    ) {
      return [];
    }
    const range = map
      .toSourceRange(
        diagnostic.start,
        diagnostic.start + (diagnostic.length ?? 0),
        true,
        (data) => !!data.verification,
      )
      .next().value;
    return range
      ? [
          {
            code: diagnostic.code,
            text: source.slice(range[0], range[1]),
            message: ts.flattenDiagnosticMessageText(
              diagnostic.messageText,
              "\n",
            ),
          },
        ]
      : [];
  });
  return {
    diagnostics: diagnostics.map((d) =>
      ts.flattenDiagnosticMessageText(d.messageText, "\n"),
    ),
    mapped,
    ...result,
  };
}

describe.each([false, true])("typeCheckingOnly: %s", (typeCheckingOnly) => {
  test.each(
    Object.entries({
      "Meta rewriting, merging, and final bindings": `
      define item {
        id 1 as Item;
        variable foo;
        child { id 2; variable bar; };
        when :( :get("foo") > 0 );
        :get("bar");
      };
      type Names = Assert<Equal<typeof Item.names, "foo" | "bar">>;
      type Mode = Assert<Equal<typeof Item.mode, false>>;
    `,
      "overload resolution": `
      define item { id 1 as Item; overloaded "a"; :get("string"); };
      type Names = Assert<Equal<typeof Item.names, "string">>;
    `,
      "bindings referenced by later Meta updates": `
      define item { id 1; plainId 1 as Id; fromId Id; };
      type IdType = Assert<Equal<typeof Id, number>>;
    `,
      "conditional required attributes": `
      define item { id 1; enable; conditional; };
    `,
      "independent definition scopes": `
      define item { id 1; since 1; };
      define item { id 2; until 2; };
    `,
      "Meta-dependent unique keys": `
      define scoped { first; second; };
    `,
      "union return types": `
      define union { value 1; };
    `,
    }),
  )("preserves %s", (_name, source) => {
    expect(check(assertions + source, typeCheckingOnly).diagnostics).toEqual(
      [],
    );
  });

  test.each([
    [
      "duplicate keys",
      "define item { id 1; since 1; until 2; };",
      ["since", "until"],
      2339,
    ],
    [
      "duplicate attributes",
      "define item { id 1; id 2; };",
      ["id", "id"],
      2339,
    ],
    ["required attribute", "define item {};", ["{}"], 2345],
    ["omitted block", "define item;", ["item"], 2345],
    [
      "conditional requirement",
      "define item { id 1; enable; };",
      ["{ id 1; enable; }"],
      2345,
    ],
    ["argument type", 'define item { id "wrong"; };', ['"wrong"'], 2345],
    [
      "action context",
      'define item { id 1; variable foo; :get("wrong"); };',
      ['"wrong"'],
      2345,
    ],
    ["attribute name", "define item { id 1; unknown; };", ["unknown"], 2339],
    ["untyped definition", "define anything { value 1; };", ["value"], 2339],
    ["hint probes", "define hintProbe { first; };", ["first"], 2339],
  ] as const)(
    "reports %s at the original source range",
    (_name, source, texts, code) => {
      const { mapped } = check(source, typeCheckingOnly);
      expect(mapped.map(({ code, text }) => ({ code, text }))).toEqual(
        texts.map((text) => ({ code, text })),
      );
    },
  );

  test("maps a required-attribute error across a long block without padding", () => {
    const block = `{\n${"  // comment\n".repeat(200)}  enable;\n}`;
    const { mapped, code } = check(`define item ${block};`, typeCheckingOnly);
    expect(mapped).toHaveLength(1);
    expect(mapped[0].text).toBe(block);
    expect(mapped[0].message).toContain(
      "'id' is a required attribute but not provided",
    );
    expect(code).not.toContain("0".repeat(100));
  });
});

test("keeps completion mappings in editor output only", () => {
  const source = "define item {\n  id 1;\n  \n};";
  const editor = transpileForVolar(source, "test.gts", {});
  const tsc = transpileForVolar(source, "test.gts", { typeCheckingOnly: true });
  expect(editor.code).toContain("ωAttrNameHint");
  expect(tsc.code).not.toContain("ωAttrNameHint");
  expect(tsc.code.length).toBeLessThan(editor.code.length);
  const offset = source.indexOf("  \n") + 1;
  const map = new SourceMap(editor.mappings);
  expect([
    ...map.toGeneratedLocation(offset, (data) => !!data.completion),
  ]).not.toEqual([]);
});
