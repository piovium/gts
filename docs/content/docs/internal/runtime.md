---
title: Runtime System
---

The runtime (`@gi-tcg/gts-runtime`) provides the execution model for transpiled GTS code. It defines the Model-View-ViewModel (MVVM) pattern that processes `define` statements at runtime.

## Overview

When a `.gts` file is transpiled and executed, the generated JavaScript calls runtime functions to:

1. Create attribute node trees ("View") from GTS definitions
2. Parse those trees through ViewModels and run codes on associated Models
3. Extract binding values (exported variables from `as` clauses)

### Entry Points

**`createDefine(rootVM, node)`** — executes a define statement (fire-and-forget):

```ts
function createDefine(
  rootVM: ViewModel<any, any>,
  node: SingleAttributeNode,
): void {
  const view = new View<any>({ attributes: [node] });
  rootVM.parse(view);
}
```

**`createBinding(rootVM, node)`** — executes a define and returns binding values:

```ts
function createBinding(
  rootVM: ViewModel<any, any>,
  node: SingleAttributeNode,
): unknown[] {
  const bindingCtx = new BindingContext();
  const view = new View<any>({ attributes: [node] }, bindingCtx);
  rootVM.parse(view);
  return bindingCtx.getBindings();
}
```

## ViewModel (`src/view_model.ts`)

### ViewModel Class

The `ViewModel<ModelT, BlockDef>` is the central execution unit:

```ts
class ViewModel<ModelT, BlockDef extends AttributeBlockDefinition> {
  constructor(private Ctor: new () => ModelT) {}

  parse(view: View<...>): ModelT {
    const model = new this.Ctor();
    for (const attrNode of view._node.attributes) {
      // Look up registered action (or binder if inside binding context)
      // Call the action with (model, positionals, namedView)
      // If binding flag set, collect the return value
    }
    return model;
  }
}
```

**Execution flow:**

1. Instantiate the Model class (`new Ctor()`)
2. Iterate over attribute nodes
3. For each attribute, look up the registered action (or binder) by name
4. Call the action with `(model, positionals, new View(named, bindingCtx))`
5. If the attribute has a `binding` flag and we're in a binding context, collect the return value
6. Return the built Model

**Action vs. Binder:**

- **Actions** are used during `createDefine` — they execute the game logic (e.g., set properties on the builder Model)
- **Binders** are used during `createBinding` — they compute the exported value (e.g., return a handle/ID)

### defineViewModel

```ts
function defineViewModel<T, BlockDef, InitMeta>(
  Ctor: new () => T,
  modelDefFn: (helper: AttributeDefHelper<T>) => BlockDef,
  initMeta?: InitMeta,
): ViewModel<T, BlockDef & { [Meta]: InitMeta }>;
```

**Usage (from `examples/provider/vm.ts`):**

```ts
const CharacterVM = defineViewModel(
  CharacterBuilder,
  (helper) => ({
    id: helper.attribute<{
      (id: number): AR.Done;
      required(): true;
      as<TMeta>(this: AR.This<TMeta>): CharacterHandle<TMeta["varNames"]>;
    }>(
      (model, pos) => {
        /* action: set ID on model */
      },
      (_, [id]) => id as CharacterHandle<any>, // binder: return handle
    ),
    since: helper.simpleAttribute()(function (version: "v3.3.0" | "v3.4.0") {
      this.setVersion(version);
    }),
    tags: helper.simpleAttribute()(function (...tags: Tag[]) {}),
    health: helper.simpleAttribute()(function (value: number) {}),
    energy: helper.simpleAttribute()(function (value: number) {}),
    skills: helper.attribute<{
      (...handles: CharacterSkillHandle[]): AR.Done;
    }>(() => {}),
  }),
  {} as { varNames: never },
);
```

### AttributeDefHelper

The helper provides two methods for defining attributes:

**`attribute<T>(action, binder?)`** — full control over action and binder:

- `action(model, positionals, namedView)` — called during define
- `binder` can be:
  - A function `(model, positionals, namedView) => value` — custom binder
  - A `ViewModel` — automatically calls `vm.parse(namedView)` as the binder
  - Omitted — no-op binder

**`simpleAttribute(options?)`** — returns a callable that takes `(action, binder?)`:

- `action` receives `this: ModelT` and spread positional args
- `binder` receives `this: ModelT` and spread positional args, returns the binding value
- `options.required?: boolean` and `options.uniqueKey?: string` add corresponding typed methods to the returned attribute definition

### AttributeReturn Types

The `AttributeReturn` (aliased as `AR`) namespace provides return type utilities:

| Type                                     | Description                                            |
| ---------------------------------------- | ------------------------------------------------------ |
| `AR.Done`                                | Attribute has no nested block and doesn't rewrite meta |
| `AR.This<TMeta>`                         | Access the current meta type (for `this` parameter)    |
| `AR.EnableIf<Cond, T>`                   | Conditional type helper                                |
| `AR.With<VM, TMeta>`                     | Attribute opens a nested ViewModel block               |
| `AR.DoneRewriteMeta<NewMeta>`            | Attribute rewrites the meta type                       |
| `AR.WithRewriteMeta<NewMeta, VM, TMeta>` | Opens nested VM and rewrites meta                      |

**Meta rewriting** is how GTS tracks *typing-only* accumulated state through attribute chains. For example, the `variable` attribute adds a variable name to the meta:

```ts
variable: helper.attribute<{
  <TMeta extends BuilderMeta, const TVarName extends string>(
    this: AR.This<TMeta>,
    variable: TVarName,
    initialValue: number,
  ): AR.WithRewriteMeta<
    {
      varNames: TMeta["varNames"] | TVarName;
    },
    typeof VariableVM
  >;
}>(() => {});
```

After `variable "foo", 42;`, the meta type changes from `{ varNames: never }` to `{ varNames: "foo" }`, enabling type-safe access to the variable later.

## Transpilation Output Example

Given this GTS source:

```gts
define character {
  id 1201 as Barbara;
  health 10;
}
```

The transpiler generates:

```js
import { createDefine, createBinding } from "@gi-tcg/gts-runtime";
import __gts_rootVm from "@example/provider/vm";

const __gts_node_0 = {
  name: "character",
  positionals: () => [],
  named: {
    attributes: [
      { name: "id", positionals: () => [1201], named: null, binding: "public" },
      { name: "health", positionals: () => [10], named: null },
    ],
  },
};
const __gts_bindings_0 = createBinding(__gts_rootVm, __gts_node_0);
export const Barbara = __gts_bindings_0[0];
createDefine(__gts_rootVm, __gts_node_0);
```

At runtime:

1. `createBinding` instantiates a `RootBuilder`, finds the `character` action, which creates a `CharacterVM` and parses the nested attributes
2. The `id` attribute's binder returns `1201 as CharacterHandle`, which becomes `Barbara`
3. `createDefine` re-runs the same process (for side effects like registration)

## Provider Pattern

The runtime is designed to be used with a **provider** — a separate package that defines the ViewModels for a specific game domain. The provider exports:

- `./vm` — the root ViewModel (default export)
- `./runtime` — re-exports from `@gi-tcg/gts-runtime`

This separation allows GTS files to be written against a stable language interface while the game implementation evolves independently.
