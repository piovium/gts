import { Parser } from "acorn";
import { DUMMY_PLACEHOLDER, loosePlugin } from "../src/parse/loose_plugin.js";
import { describe, test, expect } from "vitest";
import { parseLoose } from "../src/parse/index.js";
import type {
  BlockStatement,
  ExpressionStatement,
  MemberExpression,
  Identifier,
} from "estree";
import { tsPlugin } from "@sveltejs/acorn-typescript";

const LooseParser = Parser.extend(tsPlugin(), loosePlugin());

describe("loosePlugin", () => {
  test("should parse incomplete dot property access in block", () => {
    const code = "{ foo. }";
    const ast = LooseParser.parse(code, { ecmaVersion: "latest" });
    expect(ast).toBeDefined();

    const block = ast.body[0];
    expect(block.type).toBe("BlockStatement");
    const exprStmt = (block as BlockStatement).body[0];
    expect(exprStmt.type).toBe("ExpressionStatement");
    const memberExpr = (exprStmt as ExpressionStatement).expression;
    expect(memberExpr.type).toBe("MemberExpression");
    expect((memberExpr as MemberExpression).property.type).toBe("Identifier");
    expect(((memberExpr as MemberExpression).property as Identifier).name).toBe(
      DUMMY_PLACEHOLDER,
    );
  });

  test.each(["x.do", "x.type"])(
    "should parse .keyword as identifier",
    (code) => {
      const ast = LooseParser.parse(code, { ecmaVersion: "latest" });
      expect(ast).toBeDefined();
      const exprStmt = ast.body[0];
      expect(exprStmt.type).toBe("ExpressionStatement");
      const memberExpr = (exprStmt as ExpressionStatement).expression;
      expect(memberExpr.type).toBe("MemberExpression");
      expect((memberExpr as MemberExpression).property.type).toBe("Identifier");
      expect(
        ((memberExpr as MemberExpression).property as Identifier).name,
      ).toBe(code.slice(2));
    },
  );

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
  const defNode = ast.body.find(
    (node: any) => node.type === "GTSDefineStatement",
  );
  expect(defNode).toBeDefined();
  expect(defNode!.leadingComments).toBeDefined();
});
