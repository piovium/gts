import { test, expect } from "bun:test";
import { parse } from "../src/parse";
import { transpile } from "../src/transform";

test("basic transpile pipeline", () => {
  const source = `

function add(a: number, b: number): number {
  return a + b;
}

define foo {
  bar baz, 123;
}

export const add2 = add;
`;
  const parsed = parse(source);
  const output = transpile(parsed, { content: source, filename: "test.ts" });
  console.log(output.sourceMap.toString());
})