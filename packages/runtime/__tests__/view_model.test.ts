import { expect, test } from "vitest";
import type { AR } from "../src/attribute_return.ts";
import { createBinding, View } from "../src/view.ts";
import type { NamedAttributesNode, SingleAttributeNode } from "../src/view.ts";
import { defineViewModel } from "../src/view_model.ts";

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

test("parse and bind are inherited static methods", () => {
  class Model {
    values: string[] = [];
    prefix: string;

    constructor(prefix: string) {
      this.prefix = prefix;
    }
  }

  class VM extends defineViewModel(Model, (helper) => ({
    value: helper.simpleAttribute()(function (value: string) {
      this.values.push(`${this.prefix}:${value}`);
    }),
  })) {}

  const view = new View<any>(named([attr("value", ["direct"])]));
  expect(VM.parse(view, "root").values).toEqual(["root:direct"]);

  class BoundVM extends VM.bind("bound") {}
  expect(BoundVM.parse(view).values).toEqual(["bound:direct"]);

  class ReMetaVM extends VM.bind<{ scope: "nested" }>() {}
  expect(ReMetaVM.parse(view, "meta").values).toEqual(["meta:direct"]);
});

test("extend inherits definitions and can add child definitions", () => {
  class ParentModel {
    values: string[] = [];
  }

  class ParentVM extends defineViewModel(ParentModel, (helper) => ({
    parent: helper.simpleAttribute()(function (value: string) {
      this.values.push(`parent:${value}`);
    }),
  })) {}

  class ChildModel extends ParentModel {}

  class ChildVM extends ParentVM.extend(ChildModel, (helper) => ({
    child: helper.simpleAttribute()(function (value: string) {
      this.values.push(`child:${value}`);
    }),
  })) {}

  const result = ChildVM.parse(
    new View(named([attr("parent", ["a"]), attr("child", ["b"])])),
  );
  expect(result).toBeInstanceOf(ChildModel);
  expect(result.values).toEqual(["parent:a", "child:b"]);
});

test("a view-model class can be used as an attribute binder", () => {
  class ChildModel {
    value?: string;
  }

  class ChildVM extends defineViewModel(ChildModel, (helper) => ({
    value: helper.simpleAttribute()(
      function (value: string) {
        this.value = value;
      },
      function (value: string) {
        this.value = value;
      },
    ),
  })) {}

  class RootModel {}

  class RootVM extends defineViewModel(RootModel, (helper) => ({
    child: helper.attribute<{
      (): AR.With<ChildVM>;
    }>(() => {}, ChildVM),
  })) {}

  const bindings = createBinding(RootVM, {
    ...attr("child", [], named([attr("value", ["bound"])])),
    binding: "public",
  });
  expect(bindings).toHaveLength(1);
  expect(bindings[0]).toBeInstanceOf(ChildModel);
  expect(bindings[0]).toMatchObject({ value: "bound" });
});
