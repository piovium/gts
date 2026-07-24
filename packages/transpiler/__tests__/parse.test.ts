import { parse, parseLoose } from "../src/parse/index.ts";
import { test, expect } from "vitest";

test("member expression in attribute value", () => {
  const source = `define foo bar.baz;`;
  const ast = parse(source);
  expect(ast.body[0].type as string).toBe("GTSDefineStatement");
  const def = ast.body[0] as any;
  const attrs = def.body.body.positionalAttributes.attributes;
  expect(attrs[0].type).toBe("MemberExpression");
  expect(attrs[0].object.name).toBe("bar");
  expect(attrs[0].property.name).toBe("baz");
});

test("call expression in attribute value", () => {
  const source = `define foo bar();`;
  const ast = parse(source);
  const def = ast.body[0] as any;
  const attrs = def.body.body.positionalAttributes.attributes;
  expect(attrs[0].type).toBe("CallExpression");
  expect(attrs[0].callee.name).toBe("bar");
  expect(attrs[0].arguments).toHaveLength(0);
});

test("call expression with arguments in attribute value", () => {
  const source = `define foo bar(1, "two", three);`;
  const ast = parse(source);
  const def = ast.body[0] as any;
  const attrs = def.body.body.positionalAttributes.attributes;
  expect(attrs[0].type).toBe("CallExpression");
  expect(attrs[0].arguments).toHaveLength(3);
});

test("optional chain expression in attribute value", () => {
  const source = `define foo bar?.baz;`;
  const ast = parse(source);
  const def = ast.body[0] as any;
  const attrs = def.body.body.positionalAttributes.attributes;
  expect(attrs[0].type).toBe("ChainExpression");
  expect(attrs[0].expression.type).toBe("MemberExpression");
  expect(attrs[0].expression.optional).toBe(true);
});

test("computed member expression in attribute value", () => {
  const source = `define foo bar[baz];`;
  const ast = parse(source);
  const def = ast.body[0] as any;
  const attrs = def.body.body.positionalAttributes.attributes;
  expect(attrs[0].type).toBe("MemberExpression");
  expect(attrs[0].computed).toBe(true);
});

test("tagged template in attribute value", () => {
  const source = "define foo bar`baz`;";
  const ast = parse(source);
  const def = ast.body[0] as any;
  const attrs = def.body.body.positionalAttributes.attributes;
  expect(attrs[0].type).toBe("TaggedTemplateExpression");
});

test("chained member expression in attribute value", () => {
  const source = `define foo bar.baz.qux;`;
  const ast = parse(source);
  const def = ast.body[0] as any;
  const attrs = def.body.body.positionalAttributes.attributes;
  expect(attrs[0].type).toBe("MemberExpression");
  expect(attrs[0].object.type).toBe("MemberExpression");
  expect(attrs[0].object.property.name).toBe("baz");
  expect(attrs[0].property.name).toBe("qux");
});

test("call on member expression in attribute value", () => {
  const source = `define foo bar.baz();`;
  const ast = parse(source);
  const def = ast.body[0] as any;
  const attrs = def.body.body.positionalAttributes.attributes;
  expect(attrs[0].type).toBe("CallExpression");
  expect(attrs[0].callee.type).toBe("MemberExpression");
  expect(attrs[0].callee.property.name).toBe("baz");
});

test("multiple mixed attribute values with subscripts", () => {
  const source = `define foo bar, baz.qux, fn(), 42;`;
  const ast = parse(source);
  const def = ast.body[0] as any;
  const attrs = def.body.body.positionalAttributes.attributes;
  expect(attrs).toHaveLength(4);
  expect(attrs[0].type).toBe("Identifier");
  expect(attrs[1].type).toBe("MemberExpression");
  expect(attrs[2].type).toBe("CallExpression");
  expect(attrs[3].type).toBe("Literal");
});

test.each([parse, parseLoose])("does not apply ASI before a positional attribute comma", (parseFn) => {
  const source = `define foo first,
second;`;
  const ast = parseFn(source);
  const def = ast.body[0] as any;
  const attrs = def.body.body.positionalAttributes.attributes;
  expect(attrs).toHaveLength(2);
  expect(attrs[0].name).toBe("first");
  expect(attrs[1].name).toBe("second");
});

test.each([parse, parseLoose])("allows a trailing positional attribute comma before named attributes", (parseFn) => {
  const source = `define foo first, second,
{
  named value;
};`;
  const ast = parseFn(source);
  const def = ast.body[0] as any;
  const attrs = def.body.body.positionalAttributes.attributes;
  expect(attrs).toHaveLength(2);
  expect(def.body.body.namedAttributes.attributes[0].name.name).toBe("named");
});

test("rejects a trailing positional attribute comma without named attributes", () => {
  expect(() => parse(`define foo first, second,;`)).toThrow();
});

test("allows a trailing positional attribute comma without named attributes in looseParse", () => {
  const ast = parseLoose(`define foo first, second,;`);
  const def = ast.body[0] as any;
  const attrs = def.body.body.positionalAttributes.attributes;
  expect(attrs).toHaveLength(3);
});

test("parses comment-only input loosely", () => {
  const ast = parseLoose("// line comment\n/* block comment */");

  expect(ast.body).toHaveLength(0);
  expect((ast as any).leadingComments).toHaveLength(2);
});

test("attribute value with subscript followed by named block", () => {
  const source = `define foo bar.baz { qux 1; };`;
  const ast = parse(source);
  const def = ast.body[0] as any;
  const attrs = def.body.body.positionalAttributes.attributes;
  expect(attrs[0].type).toBe("MemberExpression");
  expect(def.body.body.namedAttributes.attributes[0].name.name).toBe("qux");
});

test("basic test", () => {
  const source = `

define entity {
  id 211011 as MyEntity;
  "type" passive;
  on endPhase {
    usage 3 { appendTo 5 };
    hint Cryo, 2;
  }
  on useSkill {
    when :( :player.hands.length > 0 )
    usagePerRound 1
    :damage(Cryo, 1, :query(opp.next))
  } as private _;
  on selfDispose {
    when :{
      const chs = :queryAll(my.character);
      return chs.length >= 2;
    }
    if (add(1, 2) > 2) {
      :dispose(:self);
    }
  }
}

function add(a: number, b: number): number {
  return a + b;
}
`;
  const ast = parse(source);
  expect(ast.type).toBe("Program");
  expect(ast.body.length).toBe(2);
  expect(ast.body[0].type as string).toBe("GTSDefineStatement");
  // Bun.write("gts-parser-basic-test-ast.json", JSON.stringify(ast, null, 2));
});
