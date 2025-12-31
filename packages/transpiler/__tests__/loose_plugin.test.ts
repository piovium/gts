import { Parser } from "acorn";
import { DUMMY_PLACEHOLDER, loosePlugin } from "../src/parse/loose_plugin.js";
import { describe, test, expect } from "bun:test";
import { parseLoose } from "../src/parse/index.js";
import type { Statement } from "estree";
import type { AST } from "../src/types.js";

const LooseParser = Parser.extend(loosePlugin());

describe("loosePlugin", () => {
  test("should parse incomplete dot property access in block", () => {
    const code = "{ foo. }";
    const ast: any = LooseParser.parse(code, { ecmaVersion: "latest" });
    expect(ast).toBeDefined();

    const block = ast.body[0];
    expect(block.type).toBe("BlockStatement");
    const exprStmt = block.body[0];
    expect(exprStmt.type).toBe("ExpressionStatement");
    const memberExpr = exprStmt.expression;
    expect(memberExpr.type).toBe("MemberExpression");
    expect(memberExpr.property.type).toBe("Identifier");
    expect(memberExpr.property.name).toBe(DUMMY_PLACEHOLDER);
  });

  test("should parse incomplete dot property access in if condition", () => {
    const code = "if (a.) {}";
    const ast: any = LooseParser.parse(code, { ecmaVersion: "latest" });
    expect(ast).toBeDefined();

    const ifStmt = ast.body[0];
    expect(ifStmt.type).toBe("IfStatement");
    const testExpr = ifStmt.test;
    expect(testExpr.type).toBe("MemberExpression");
    expect(testExpr.property.name).toBe(DUMMY_PLACEHOLDER);
  });

  test("should fail on invalid bracket access", () => {
    const code = "foo[var]";
    expect(() => {
      LooseParser.parse(code, { ecmaVersion: "latest" });
    }).toThrow();
  });

  test("should fail on invalid optional call argument", () => {
    const code = "foo?.(var)";
    expect(() => {
      LooseParser.parse(code, { ecmaVersion: "latest" });
    }).toThrow();
  });
});

test("comment kept in loose parse", () => {
  const code = `
/**
 * @description This is a test function
 */
define character {
  id 1101 as TestCharacter;
}    
`;
  const ast = parseLoose(code);
  console.log(ast);
  const defNode = ast.body.find(
    (node: any) => node.type === "GTSDefineStatement",
  );
  expect(defNode).toBeDefined();
  expect(defNode!.leadingComments).toBeDefined();
});
