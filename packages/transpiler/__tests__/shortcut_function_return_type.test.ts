import { expect, test } from "vitest";
import { parse } from "../src/parse/index.ts";
import { transpile, transpileForVolar } from "../src/index.ts";

const source = `
define expression :<boolean>(1 == 2);
define block :<number>{ return 42; };
`;

test("parses shortcut function return types", () => {
  const ast = parse(source);
  const shortcuts = ast.body.map(
    (statement: any) =>
      statement.body.body.positionalAttributes.attributes[0],
  );

  expect(shortcuts).toHaveLength(2);
  expect(shortcuts[0]).toMatchObject({
    type: "GTSShortcutFunctionExpression",
    expression: true,
    returnType: {
      type: "TSBooleanKeyword",
    },
  });
  expect(shortcuts[1]).toMatchObject({
    type: "GTSShortcutFunctionExpression",
    expression: false,
    returnType: {
      type: "TSNumberKeyword",
    },
  });
});

test("emits shortcut return types only for Volar", () => {
  const runtime = transpile(source, "shortcut-return-types.gts", {});
  expect(runtime.code).not.toMatch(/:\s*(boolean|number)\b/);

  const volar = transpileForVolar(source, "shortcut-return-types.gts", {});
  expect(volar.code).toContain("(__gts_fnArg): boolean =>");
  expect(volar.code).toContain("(__gts_fnArg): number =>");
});
