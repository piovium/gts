---
title: Language Tooling
---

GTS provides full IDE support through a Volar-based language server, a TypeScript Language Service Plugin, and a VS Code extension.

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                   VS Code Extension                          │
│  (gamingts-vscode)                                           │
│  ┌───────────────────┐                                       │
│  │  Extension Client │  selects a native-SDK tsdk            │
│  │  (extension.ts)   │  and starts the language client       │
│  └────────┬──────────┘                                       │
│           │                                                  │
│  ┌────────┴───────────────────────────────────────────────┐  │
│  │              Language Server (node.ts)                 │  │
│  │  ┌────────────────────┐  ┌──────────────────────────┐  │  │
│  │  │ TypeScript Service │  │  Diagnostics Plugin      │  │  │
│  │  │ (volar-service-ts) │  │  (GTS transpiler errors) │  │  │
│  │  └────────────────────┘  └──────────────────────────┘  │  │
│  │  ┌──────────────────────────────────────────────────┐  │  │
│  │  │           Language Plugin                        │  │  │
│  │  │  ┌────────────────────────────────────────────┐  │  │  │
│  │  │  │         GtsVirtualCode                     │  │  │  │
│  │  │  │  (transpileForVolar -> code + mappings)    │  │  │  │
│  │  │  └────────────────────────────────────────────┘  │  │  │
│  │  └──────────────────────────────────────────────────┘  │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

## Language Plugin (`@gi-tcg/gts-language-plugin`)

The language plugin is the bridge between the GTS transpiler and the Volar framework. It implements the `LanguagePlugin` interface from `@volar/language-core`.

### `GtsVirtualCode` (`virtual_code.ts`)

Implements the Volar `VirtualCode` interface:

```ts
class GtsVirtualCode implements VirtualCode {
  id = "root";
  languageId = "gaming-ts";
  mappings: CodeMapping[];
  snapshot: ts.IScriptSnapshot;
  errors: GtsTranspilerError[];
}
```

**Constructor:**

1. Gets the source text from the snapshot
2. Calls `transpileForVolar(source, filename, config)`
3. On success: stores the generated code and Volar mappings
4. On error: stores the error, generates an empty (whitespace-only) snapshot with a single verification mapping so that the error can be reported as a diagnostic

**Error recovery:** When transpilation fails, the virtual code returns a snapshot filled with spaces (matching the source line lengths). This prevents the language server from crashing while still providing the source location for error diagnostics.

## Language Server (`@gi-tcg/gts-language-server`)

The language server implements the Language Server Protocol (LSP). It has two entry points: the **Node.js server** (`node.ts`) and the **browser server** (`browser.ts`).

### Custom Services

- **TypeScript Services** — wraps `volar-service-typescript`:
  - Adds **space** as a signature help trigger character. GTS syntax uses `name arg1, arg2`, which transpiles to `name(arg1, arg2)`, so a space after an attribute name should trigger signature help.
  - Adds `gtsAttribute` as a semantic token modifier (used by the _Semantic Token Service_).
  - Drops the syntactic service's document formatting, which the extension leaves to Prettier.
- **Diagnostics Service** — surfaces `GtsTranspilerError` instances from the virtual code as LSP diagnostics. Converts the transpiler's 1-based line/column positions to 0-based LSP positions.
- **Completion Service** — triggered by `:`. Returns the TS semantic service's results with the trigger character changed from `:` to `.`, and hides suggestions starting with `__gts_`.
- **Semantic Token Service** — overrides the TS semantic service to add italic markup for mappings recognized as a GTS attribute name.
- **Code Lens Service** — adds a Code Lens line above each direct function so its definition is visually separated from the preceding attributes.

## TypeScript Language Service Plugin (`@gi-tcg/gts-typescript-language-service-plugin`)

A CJS module that integrates GTS into TypeScript's built-in language service, so `tsserver` resolves `import foo from "./foo.gts"` from a `.ts` file. TypeScript loads it as a plugin through `tsconfig.json`:

```json
{
  "compilerOptions": {
    "plugins": [{ "name": "@gi-tcg/gts-typescript-language-service-plugin" }]
  }
}
```

## VS Code Extension (`gamingts-vscode`)

### TypeScript Language Service Plugin Declaration

The extension declares the plugin (`@gi-tcg/gts-typescript-language-service-plugin`) under `typescriptServerPlugins`, so the `tsserver` it runs loads it and resolves `.gts` imports. The same declaration lists `gaming-ts` in `languages`, which is what makes the built-in TypeScript extension synchronise `.gts` documents — including unsaved ones — to that `tsserver`; without it, a `.ts` consumer would only see the last saved version of the `.gts` module it imports. The extension redirects that `tsserver` to the same native SDK its own language server uses, so the two keep the same program semantics.

### Regex-based Syntax Highlighting (`syntaxes/GamingTS.tmLanguage.json`)

A generated TextMate grammar from official TS one, that provides syntax highlighting for GTS files, for covering:
- GTS-specific keyword (`define`)
- Attribute definitions and blocks
- Shortcut function syntax (`:identifier`, `:( expr )`, `:{ stmts }`)

## How IDE Features Work

### Completions

1. User types in a `.gts` file
2. The language plugin transpiles (see below) the source to TypeScript with Volar mappings
3. TypeScript's completions service runs on the generated code
4. Volar maps the completions back to the source positions

For attribute names: the generated code creates typed variables like `__gts_attr_obj_0.id(...)`, so TypeScript provides completions based on the ViewModel's attribute definitions.

### Diagnostics

Two sources of diagnostics:
1. **Transpiler errors** — surfaced by the diagnostics plugin (syntax errors, unsupported features)
2. **TypeScript errors** — type checking on the generated code, mapped back to source positions (type mismatches, etc. Done by Volar.js and our point-to-point mapping of each syntax production)

### Signature Help

When the user types a space after an attribute name (e.g., `id `), the language server triggers signature help because space is registered as a trigger character. The generated code contains a function call (`__gts_attr_obj_0.id(...)`), so TypeScript provides parameter information. The generated left parenthesis is mapped back to its source position so the request lands on the call.

### Go-to-Definition / Hover

These work through the Volar mappings — source positions map to generated positions, and TypeScript resolves definitions and types in the generated code.

### Auto-Import Insertion

This is done by resolving the location where TSServer inserts new imports. When auto-importing (code action or completion), TSServer determines the insertion point by looking at existing import declarations. The language server intercepts this through the Volar transform by:

1. **Making generated imports unsorted** — an unrelated `ExpressionStatement` (`0;`) is inserted between system-generated import declarations and the last import group. This makes the generated imports appear "unsorted" to TSServer, so it always chooses the position after the final generated import as the insertion point.

2. **Mapping to content start** — if the last import is a generated one, it gets an extra range mapping from the newline after it to the content start offset in the source file. The "content start" is calculated by `getContentStartOffset()` (`volar/content_start.ts`), which skips hashbang lines (`#!/usr/bin/env node`) and leading block-level comments (until two consecutive blank lines or non-comment content is encountered), yielding the character offset where meaningful content begins. This is used as the source mapping target so auto-imports are placed after file headers but before the main code.

## Volar Transform (`src/transform/volar/`)

The Volar transform generates TypeScript type declarations for IDE features. Instead of producing runnable code, it generates type-level constructs that let TypeScript's type checker validate GTS definitions.

### Overview

The Volar pipeline differs from the runtime pipeline:

1. Uses a **typing walker** instead of the runtime visitor
2. Generates **type aliases and typed variables** instead of function calls
3. Uses a **replacement system** for complex type constructs (expanded after printing)
4. Uses **`espolar`** for printing, which produces **Volar CodeMappings** natively

### Typing Walker (`volar/walker.ts`)

The `gtsToTypingsWalker` visitor generates type information by maintaining stacks:

- **`vmDefTypeIdStack`** — tracks the type of the current ViewModel's definition (what attributes are available)
- **`metaTypeIdStack`** — tracks the current meta type (accumulated state from attribute calls)
- **`finalMetaTypeIdStack`** — tracks the final meta type after all attributes in a block
- **`attrsOfCurrentVm`** — tracks which attribute names have been used (for required attribute validation)

**Key operations:**

- `enterVMFromRoot(state)` — starts processing a `define` block. Emits type aliases for the root VM's definition type and initial meta type.
- `enterVMFromAttr(state, returningId)` — enters a nested ViewModel from an attribute's return type (e.g., `skill` attribute returns a `SkillVM`).
- `exitVM(state)` — validates that all required attributes have been provided. Emits a type check that produces an error if required attributes are missing.
- `enterAttr(state, attrName)` — prepares to call an attribute. Creates a typed variable that combines the current meta with the VM definition.
- `exitAttr(state, returningId)` — updates the meta type based on the attribute's return type (some attributes can rewrite the meta, e.g., adding variable names).
- `insertHintStatement(state, whiteSpaceStart, whiteSpaceEnd)` — inserts a synthetic `GTSAttributeNameHintStatement` node that maps whitespace regions inside `define` blocks to virtual code. When printed, this becomes `__gts_attr_obj.<whitespace>// @ts-ignore` + `ωAttrNameHint;`, with the whitespace source-mapped. This enables Volar to provide attribute name completions when the user's cursor is in whitespace areas between attributes in a `define` block.
- `genBindingTyping(state, info)` — generates a type for a binding export (the `as` clause).

### Replacement System (`volar/replacements.ts`)

Complex type constructs can't be expressed directly in the AST. Instead, the walker emits **placeholder tagged template expressions**:

```js
__gts_replacement_tag`{"type":"enterVMFromRoot","vm":"__root_vm",...}`;
```

After printing with `espolar`, `applyReplacements()` regex-replaces these placeholders with actual TypeScript type code, and adjusts the generated offsets in the already-produced `CodeMapping[]` to account for length differences. For example, `enterVMFromRoot` becomes:

```ts
type __gts_rootVmDefType_0 = (typeof __root_vm)[__gts_symbols_namedDef];
type __gts_rootVmInitMetaType_1 = __gts_rootVmDefType_0[__gts_symbols_meta];
```

The `exitVM` replacement generates a required-attribute validation check:

```ts
namespace __rans {
  export type Collected = "id" | "since" | "tags";
  export type Expected = { [K in keyof DefType]: ... }[keyof DefType];
}
((_: __rans.Expected extends __rans.Collected ? string : __rans.Expected) => 0)("...");
```

This produces a TypeScript error if required attributes are missing.

### Attribute Name Hints (`GTSAttributeNameHintStatement`)

When editing inside a `define` block, users often need completions for available attribute names in whitespace areas. For example, after typing a semicolon or inside an empty block body:

```
define Foo {      // cursor here -> need attr name completions
  id 1;           // cursor here -> need attr name completions
}
```

The typing walker inserts synthetic `GTSAttributeNameHintStatement` nodes in `GTSNamedAttributeBlock` at two positions:

1. **After the block opening `{`:** Maps whitespace between `{` and the first attribute to `__gts_attr_obj.<whitespace>// @ts-ignore` + `ωAttrNameHint;`.
2. **After each attribute's semicolon:** Maps whitespace between an attribute's end and the next token to the same output.

These hint statements reuse the `enterAttr`/`exitAttr` mechanism with a special attribute name `"~attrNameHint"`, but generate `hintOnly: true` replacements (producing `{}` instead of `{ Meta: ... }` in the type variable) to avoid unnecessary meta-type accumulation. The dedicated printer writes the object, a `.`, the source-mapped whitespace range, and a trailing `// @ts-ignore` `ωAttrNameHint;`, so Volar can trigger completions at those positions.

### Printing & Mappings (`volar/printer.ts`, `volar/mappings.ts`)

The Volar pipeline uses **`espolar`** (instead of `esrap`) for printing. `espolar` generates Volar `CodeMapping[]` directly alongside the code output, eliminating the need for a separate source-map-to-mapping conversion step.

#### Runtime vs Volar Printers

| Pipeline                  | Printer   | Output                                                          |
| ------------------------- | --------- | --------------------------------------------------------------- |
| Runtime (`transpile`)     | `esrap`   | `{ code, sourceMap }` (source map v3, decoded from VLQ)         |
| IDE (`transpileForVolar`) | `espolar` | `{ code, mappings }` (Volar `CodeMapping[]`, produced natively) |

## Configuration for Language Tooling

Language tooling reads GTS configuration from the nearest `package.json` using `resolveGtsConfigSync()`. This determines which provider to use, which affects the ViewModel types available in completions. See [Configuration](/docs/configuration) for details.
