import { test, expect } from "vitest";
import { type } from "arktype";
import { defineSimpleViewModel } from "../src/simple_view_model.ts";
import { View } from "../src/view.ts";
import type { NamedAttributesNode, SingleAttributeNode } from "../src/view.ts";

function named(attributes: SingleAttributeNode[]): NamedAttributesNode {
  return { attributes };
}

function attr(
  name: string,
  positionals: unknown[],
  subNamed: NamedAttributesNode | null = null,
): SingleAttributeNode {
  return { name, positionals: () => positionals, named: subNamed };
}

test("basic (no options)", () => {
  const vm = defineSimpleViewModel(
    type({
      name: "string",
      count: "number",
    }),
  );
  const result = vm.parse(
    new View(
      named([
        attr("name", ["hello"]),
        attr("count", [42]),
      ]),
    ),
  );
  expect(result).toEqual({ name: "hello", count: 42 });
});

test("booleanSwitch: boolean property", () => {
  const vm = defineSimpleViewModel(
    type({
      flag: "boolean",
    }),
    { booleanSwitch: true },
  );
  const result = vm.parse(
    new View(
      named([attr("flag", [])]),
    ),
  );
  expect(result).toEqual({ flag: true });
});

test("booleanSwitch: anyOf with boolean branch", () => {
  const vm = defineSimpleViewModel(
    type({
      flag: "boolean | string",
    }),
    { booleanSwitch: true },
  );
  const result = vm.parse(
    new View(
      named([attr("flag", [])]),
    ),
  );
  expect(result).toEqual({ flag: true });
});

test("recursive: named block for object property", () => {
  const vm = defineSimpleViewModel(
    type({
      foo: { bar: "string", baz: "number" },
    }),
    { recursive: true },
  );
  const result = vm.parse(
    new View(
      named([attr("foo", [], named([attr("bar", ["hello"]), attr("baz", [42])]))]),
    ),
  );
  expect(result).toEqual({ foo: { bar: "hello", baz: 42 } });
});

test("recursive: positional object still works", () => {
  const vm = defineSimpleViewModel(
    type({
      foo: { bar: "string", baz: "number" },
    }),
    { recursive: true },
  );
  const result = vm.parse(
    new View(
      named([attr("foo", [{ bar: "hello", baz: 42 }])]),
    ),
  );
  expect(result).toEqual({ foo: { bar: "hello", baz: 42 } });
});

test("recursive: anyOf with nullable object", () => {
  const vm = defineSimpleViewModel(
    type({
      foo: ["null", "|", { bar: "string" }],
    }),
    { recursive: true },
  );
  const result = vm.parse(
    new View(
      named([attr("foo", [], named([attr("bar", ["hello"])]))]),
    ),
  );
  expect(result).toEqual({ foo: { bar: "hello" } });
});

test("recursive: nested", () => {
  const vm = defineSimpleViewModel(
    type({
      foo: { bar: { deep: "string" } },
    }),
    { recursive: true },
  );
  const result = vm.parse(
    new View(
      named([attr("foo", [], named([attr("bar", [], named([attr("deep", ["value"])]))]))]),
    ),
  );
  expect(result).toEqual({ foo: { bar: { deep: "value" } } });
});

test("recursive + booleanSwitch combined", () => {
  const vm = defineSimpleViewModel(
    type({
      flag: ["boolean", "|", { bar: "string" }],
    }),
    { booleanSwitch: true, recursive: true },
  );
  const result1 = vm.parse(
    new View(
      named([
        attr("flag", []),
      ]),
    ),
  );
  expect(result1).toEqual({ flag: {} });
  const result2 = vm.parse(
    new View(
      named([
        attr("flag", [], named([attr("bar", ["hello"])])),
      ]),
    ),
  );
  expect(result2).toEqual({ flag: { bar: "hello" } });
});

test("recursive: anyOf with multiple type:object branches is not recursive", () => {
  const vm = defineSimpleViewModel(
    type({
      foo: [{ bar: "string" }, "|", { baz: "number" }],
    }),
    { recursive: true },
  );
  const result = vm.parse(
    new View(
      named([attr("foo", [{ bar: "hello" }])]),
    ),
  );
  expect(result).toEqual({ foo: { bar: "hello" } });
});

test("options default to false", () => {
  const vm = defineSimpleViewModel(
    type({
      flag: "boolean",
      nested: { bar: "string" },
    }),
  );
  // booleanSwitch not enabled: empty positionals = undefined
  const r1 = vm.parse(new View(named([attr("flag", [])])));
  expect(r1).toEqual({ flag: undefined });

  // recursive not enabled: named block ignored, positionals used
  const r2 = vm.parse(new View(named([attr("nested", [], named([attr("bar", ["hello"])]))])));
  expect(r2).toEqual({ nested: undefined });
});
