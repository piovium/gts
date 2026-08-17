import { expect, expectTypeOf, test } from "vitest";
import type { AR } from "../src/attribute_return.ts";
import {
  ActionModel,
  defineActionViewModel,
  getCurrentContext,
  getCurrentModelContext,
  getCurrentView,
  type ModelConstructionContext,
} from "../src/index.ts";
import { createBinding, createDefine, View } from "../src/view.ts";
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

  class ReMetaVM extends VM.narrow({ scope: "nested" }) {}
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

test("defineActionViewModel defines a Meta-aware direct action", () => {
  type Meta = {
    names: string;
  };
  type GenericAction<CurrentMeta extends Meta> = (
    name: CurrentMeta["names"],
  ) => void;

  class VM extends defineActionViewModel<
    <CurrentMeta extends Meta>(
      this: AR.This<CurrentMeta>,
      action: GenericAction<CurrentMeta>,
    ) => AR.Done,
    { names: "foo" }
  >() {}

  type NamedDefinition = (typeof VM)["~namedDefinition"];
  expectTypeOf<keyof NamedDefinition>().toEqualTypeOf<"~action" | "~meta">();
  expectTypeOf<NamedDefinition["~meta"]>().toEqualTypeOf<{
    names: "foo";
  }>();
  if (false) {
    const definition = null as unknown as NamedDefinition;
    definition["~action"]((name) => {
      expectTypeOf(name).toEqualTypeOf<"foo">();
      return name;
    });
  }

  const result = VM.parse(
    new View(named([attr("~action", [(name: "foo") => `action:${name}`])])),
  );
  expect(result).toBeInstanceOf(ActionModel);
  expect(result.action("foo")).toBe("action:foo");
});

test("model constructors receive stable views across binder and action passes", () => {
  const rootContexts: ModelConstructionContext[] = [];
  const childContexts: ModelConstructionContext[] = [];
  let actionNamedView: View<any> | undefined;
  let binderNamedView: View<any> | undefined;
  let actionViewBeforeNestedParse: View<any> | null = null;
  let actionViewAfterNestedParse: View<any> | null = null;

  class ChildModel {
    constructor() {
      const context = getCurrentModelContext();
      expect(context).not.toBeNull();
      childContexts.push(context!);
      expect(getCurrentView()).toBe(context!.view);
      expect(getCurrentContext()).toBe(context!.phase);
    }
  }

  class ChildVM extends defineViewModel(ChildModel, () => ({})) {}

  class RootModel {
    constructor() {
      const context = getCurrentModelContext();
      expect(context).not.toBeNull();
      rootContexts.push(context!);
    }
  }

  class RootVM extends defineViewModel(RootModel, (helper) => ({
    child: helper.attribute<{
      (): AR.With<ChildVM>;
      as(): ChildModel;
    }>(
      (_, __, namedView) => {
        actionNamedView = namedView;
        actionViewBeforeNestedParse = getCurrentView();
        ChildVM.parse(namedView);
        actionViewAfterNestedParse = getCurrentView();
      },
      (_, __, namedView) => {
        binderNamedView = namedView;
        return ChildVM.parse(namedView);
      },
    ),
  })) {}

  const node = {
    ...attr("child", [], named([])),
    binding: "public" as const,
  };

  const bindings = createBinding(RootVM, node);
  expect(getCurrentModelContext()).toBeNull();
  createDefine(RootVM, node);

  expect(bindings[0]).toBeInstanceOf(ChildModel);
  expect(rootContexts.map(({ phase }) => phase)).toEqual([
    "binder",
    "action",
  ]);
  expect(rootContexts[0].view).toBe(rootContexts[1].view);
  expect(childContexts.map(({ phase }) => phase)).toEqual([
    "binder",
    "action",
  ]);
  expect(childContexts[0].view).toBe(childContexts[1].view);
  expect(binderNamedView).toBe(actionNamedView);
  expect(childContexts[0].view).toBe(binderNamedView);
  expect(actionViewBeforeNestedParse).toBe(rootContexts[1].view);
  expect(actionViewAfterNestedParse).toBe(rootContexts[1].view);
  expect(getCurrentModelContext()).toBeNull();
  expect(getCurrentView()).toBeNull();
  expect(getCurrentContext()).toBeNull();
});

test("model construction context is restored after parse errors", () => {
  class Model {
    constructor() {
      expect(getCurrentView()).not.toBeNull();
    }
  }

  class VM extends defineViewModel(Model, (helper) => ({
    fail: helper.simpleAttribute()(function () {
      throw new Error("expected failure");
    }),
  })) {}

  expect(() => createDefine(VM, attr("fail", []))).toThrow(
    "expected failure",
  );
  expect(getCurrentModelContext()).toBeNull();
  expect(getCurrentView()).toBeNull();
  expect(getCurrentContext()).toBeNull();
});
