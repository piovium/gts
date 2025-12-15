# transpiler 构思

对于每个 named attribute，生成一个函数返回 attribute information；define 语句返回 `createDefine`

```ts
define foo bar, baz, {
  a 42;
}
```

```js
import { createDefine } from "@gi-tcg/gts-runtime";
import rootVM from "#provider/vm";

createDefine(rootVM, {
  attributes: [
    () => ({
      name: "foo",
      positionals: ["bar", "baz"],
      named: {
        attributes: [
          () => ({
            name: "a",
            positionals: [42],
          })
        ]
      }
    })
  ]
});
```

## bindings

对于 bindings，将所有 binding 本身的 attribute definition 提出来，然后用 binder 返回具体值：

```
define foo bar, baz, {
  id 1101 as Ganyu;
  a 42;
}
```

```js
import { createDefine } from "@gi-tcg/gts-runtime";
import rootVM from "#provider/vm";
import binder from "#provider/binder";

// ALWAYS on top of the module
const __id_attribute = () => ({
  name: "id",
  positionals: [1101],
})
export const Ganyu = binder(__id_attribute);

// -----

createDefine(rootVM, {
  attributes: [
    () => ({
      name: "foo",
      positionals: ["bar", "baz"],
      named: {
        attributes: [
          __id_attribute,
          () => ({
            name: "a",
            positionals: [42],
          })
        ]
      }
    })
  ]
});
```

## TS VirtualCode

不产出真实运行时代码，只产出类型推导代码

```
define foo bar, baz, {
  id 1101 as Ganyu;
  a 42;
}
```

```ts
import rootVM from "#provider/vm";
import binder from "#provider/binder";

export const Ganyu: Binding0 = (void 0)!;

type VMDef = (typeof rootVM)[NamedDefinition];
type Meta0 = VMDef[MetaSymbol];

let obj0!: { [MetaSymbol]: Meta0 } & Omit<VMDef, MetaSymbol>;
let return0 = obj0.id(123); // <- cursor after `.` for suggestion of attribute name; after `(` for positional args
type Return0 = typeof return0;
// Override parent meta: Attatch `rewriteMeta` to obj's [MetaSymbol]
type Meta1 = Return0 extends { rewriteMeta: infer NewMeta extends {} } ? NewMeta : Meta0;
let obj1!: { [MetaSymbol]: Meta1 } & Omit<VMDef, MetaSymbol>;
// Infer binding type: Attach `as` to a [MetaSymbol]-contained object
type AsType0 = typeof obj0.id extends { as: infer As } ? As : unknown;
let inferBindingObj0 = { [MetaSymbol]: obj1[MetaSymbol], as: 0 as any as AsType1 };
let binding0 = inferBindingObj0.as();
type Binding0 = typeof binding0;

let return1 = obj1.a(42); // same as above
```