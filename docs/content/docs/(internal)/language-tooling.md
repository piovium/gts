---
title: Language Tooling
---

GTS provides full IDE support through a Volar-based language server, a TypeScript Language Service Plugin, and a VS Code extension.

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                      VS Code Extension                       │
│  (gts-vscode)                                                │
│  ┌───────────────────┐  ┌──────────────────────────────────┐ │
│  │  Extension Client │  │  TS Extension Patch (patch.ts)   │ │
│  │  (extension.ts)   │  │  Adds "gaming-ts" to TS modes    │ │
│  └────────┬──────────┘  └──────────────┬───────────────────┘ │
│           │                            │                     │
│  ┌────────┴────────────────────────────┴──────────────────┐  │
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

### `createGtsLanguagePlugin(ts)` (`language_plugin.ts`)

Returns a `LanguagePlugin<URI | string>` with:

**`getLanguageId(uri)`** — returns `"gaming-ts"` for `.gts` files.

**`createVirtualCode(uri, languageId, snapshot)`** — creates a `GtsVirtualCode` instance:
1. Resolves GTS configuration from the nearest `package.json` (using `resolveGtsConfigSync`)
2. Calls `transpileForVolar()` to generate TypeScript type declarations
3. Returns the virtual code with source mappings

**`typescript.extraFileExtensions`** — registers `.gts` as a TypeScript file extension with `ScriptKind.Deferred`.

**`typescript.getServiceScript(root)`** — maps the virtual code to a `.ts` service script with `ScriptKind.TS`.

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

The language server implements the Language Server Protocol (LSP). It has two entry points:

### Node.js Server (`node.ts`)

```ts
const connection = createConnection();
const server = createServer(connection);

connection.onInitialize((params) => {
  const tsdk = loadTsdkByPath(params.initializationOptions.typescript.tsdk, params.locale);
  return server.initialize(params,
    createTypeScriptProject(tsdk.typescript, tsdk.diagnosticMessages, () => ({
      languagePlugins: [createGtsLanguagePlugin(tsdk.typescript)],
    })),
    [...createTypeScriptServices(tsdk.typescript), createDiagnosticsPlugin()],
  );
});
```

### Browser Server (`browser.ts`)

Same structure but uses `loadTsdkByUrl` to load TypeScript from a CDN URL (default: `https://cdn.jsdelivr.net/npm/typescript@latest/lib`).

### Custom Services

**TypeScript Services (`typescript.ts`)** — wraps `volar-service-typescript` and adds **space** as a signature help trigger character. This is because GTS syntax uses `name arg1, arg2` which transpiles to `name(arg1, arg2)`, so pressing space after an attribute name should trigger signature help.

**Diagnostics Plugin (`diagnostics.ts`)** — surfaces `GtsTranspilerError` instances from the virtual code as LSP diagnostics. Converts the transpiler's 1-based line/column positions to 0-based LSP positions.

**Document Highlight Service (`document_highlight.ts`)** — extends the TypeScript semantic service's document highlight to also work for GTS-specific keywords. Currently partially implemented (some code is commented out).

## TypeScript Language Service Plugin (`@gi-tcg/gts-typescript-language-service-plugin`)

A CJS module that integrates GTS into TypeScript's built-in language service:

```ts
export = createLanguageServicePlugin((ts, info) => {
  return { languagePlugins: [createGtsLanguagePlugin(ts)] };
});
```

This enables GTS features directly in editors that use TypeScript's language service (without needing a separate LSP server). It's loaded as a TypeScript plugin through `tsconfig.json`:

```json
{
  "compilerOptions": {
    "plugins": [{ "name": "@gi-tcg/gts-typescript-language-service-plugin" }]
  }
}
```

## VS Code Extension (`gts-vscode`)

### Extension Client (`extension.ts`)

**Activation:** triggers on `onLanguage:gaming-ts`.

**Setup:**
1. Calls `patchTypeScriptExtension()` to inject GTS support into VS Code's built-in TypeScript extension
2. If patching requires a restart, prompts the user
3. Starts the language server as a child process (IPC transport)
4. Registers auto-insertion support for the `gaming-ts` language
5. Integrates with Volar Labs for debugging

**Language Server Configuration:**
```ts
const clientOptions: LanguageClientOptions = {
  documentSelector: [{ language: "gaming-ts" }],
  initializationOptions: {
    typescript: { tsdk: (await getTsdk(context))!.tsdk },
  },
};
```

### TypeScript Extension Patch (`patch.ts`)

The VS Code extension patches the built-in TypeScript extension to recognize `.gts` files:

1. Intercepts `require("fs").readFileSync` for the TypeScript extension's main JS file
2. Modifies the code to:
   - Add `"gaming-ts"` to `jsTsLanguageModes` 
   - Add `"gaming-ts"` to `isSupportedLanguageMode` 
   - Add `"gaming-ts"` to `isTypeScriptDocument`
   - Sort plugins to prioritize the GTS language service plugin
3. If the TypeScript extension is already loaded, invalidates the module cache and re-requires it

This patching ensures that VS Code's TypeScript features (hover, go-to-definition, etc.) work in `.gts` files.

### Syntax Highlighting (`syntaxes/GamingTS.tmLanguage.json`)

A comprehensive TextMate grammar (~5800 lines) that provides syntax highlighting for GTS files. It covers:
- Standard TypeScript syntax (comments, strings, types, expressions)
- GTS-specific keyword (`define`)
- Attribute definitions and blocks
- Shortcut function syntax (`:identifier`, `:(expr)`, `:{stmts}`)

### Language Configuration (`language-configuration.json`)

Editor settings for GTS files:
- Bracket pairs and auto-closing pairs
- Comment toggling (`//` and `/* */`)
- Folding regions (brace-based)
- Indentation rules
- Word patterns

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
2. **TypeScript errors** — type checking on the generated code, mapped back to source positions (type mismatches, missing required attributes)

### Signature Help

When the user types a space after an attribute name (e.g., `id `), the language server triggers signature help because space is registered as a trigger character. The generated code contains a function call (`__gts_attr_obj_0.id(...)`), so TypeScript provides parameter information. The `lParenLoc` recording in the parser ensures correct mapping for function calls.

### Go-to-Definition / Hover

These work through the Volar mappings — source positions map to generated positions, and TypeScript resolves definitions/types in the generated code. The preservation of leading comments during transpilation keeps documentation of definition when Hover.

###  Auto-Import Insertion

This is done by resolving the location where TSServer inserts new imports. When auto-importing (code action or completion), TSServer determines the insertion point by looking at existing import declarations. The language server intercepts this through the Volar transform by:

1. **Making generated imports unsorted** — an unrelated `ExpressionStatement` (`0;`) is inserted between system-generated import declarations and the last import group. This makes the generated imports appear "unsorted" to TSServer, so it always chooses the position after the final generated import as the insertion point.

2. **Mapping to content start** — if the last import is a generated one, it will gets an extra range mapping that maps a newline after it to the content start offset in the source file. The "content start" is calculated by `getContentStartOffset()` (`volar/content_start.ts`), that skips hashbang lines (`#!/usr/bin/env node`) and leading block-level comments (until two consecutive blank lines or non-comment content is encountered), yielding the character offset where meaningful content begins. This is used as the source mapping target so auto-imports are placed after file headers but before the main code.

3. **Enlarged import declaration mapping** For each user's import, if it was mapped as end of a mapping range, then the transpiler will enlarge its mapping range 1 character from its right boundary, to cover TSServer's insertion point.

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
- `insertHintStatement(state, whiteSpaceStart, whiteSpaceEnd)` — inserts a synthetic `GTSAttributeNameHintStatement` node that maps whitespace regions inside `define` blocks to virtual code. When printed, this becomes `__gts_attr_obj.  ;` where the whitespace is source-mapped. This enables Volar to provide attribute name completions when the user's cursor is in whitespace areas between attributes in a `define` block.
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

1. **After the block opening `{`:** Maps whitespace between `{` and the first attribute to `__gts_attr_obj.  ;`.
2. **After each attribute's semicolon:** Maps whitespace between an attribute's end and the next token to `__gts_attr_obj.  ;`.

These hint statements reuse the `enterAttr`/`exitAttr` mechanism with a special attribute name `"~attrNameHint"`, but generate `hintOnly: true` replacements (producing `{}` instead of `{ Meta: ... }` in the type variable), avoiding unnecessary meta-type accumulation. The dedicated printer outputs `object.` followed by `context.writeSource()` for the whitespace range and a trailing `";"`, creating a source-to-generated mapping so Volar can trigger completions at those positions.

### Printing & Mappings (`volar/printer.ts`, `volar/mappings.ts`)

The Volar pipeline uses **`espolar`** (instead of `esrap`) for printing. `espolar` generates Volar `CodeMapping[]` directly alongside the code output, eliminating the need for a separate source-map-to-mapping conversion step.

#### `getPrintOptions()` (`volar/printer.ts`)

Configures `espolar`'s `PrintOptions<CodeInformation>` with:

- **`isUntouched`** — returns `true` for nodes from the original source (tracked via `state.sourceNodes: WeakSet<Node>`), so `espolar` preserves their original text and creates proper source-to-generated mappings.
- **`getMappingData`** — returns `DEFAULT_VOLAR_MAPPING_DATA` (all capabilities: completion, format, navigation, semantic, structure, verification) for most mappings, or `VERIFICATION_ONLY_MAPPING_DATA` for diagnostic-only mappings.
- **Custom printers** — overrides for specific node types:
  - **`Identifier`** — dummy identifiers print as `""` (or `","` if the node is the last argument of a `CallExpression`, to preserve TypeScript error detection). Uses `context.writeMapped()` to create inline mappings with correct source ranges.
  - **`Literal`** — identifiers wrapped as string literals (lowercase positional args like `cryo`) are printed with quote mapping: the source maps to the content between the quotes. Import sources (`"..."` in generated import statements) with `diagnosticsOnTop` get a verification-only mapping to the top of the source file for missing-import diagnostics.
  - **`ImportDefaultSpecifier` / `ImportSpecifier`** — generated import specifiers also get top-of-file diagnostic mappings via `context.createExtraMapping()`.
  - **`GTSAttributeNameHintStatement`** — prints as `object.` followed by source-mapped whitespace and a trailing `";"`. The whitespace region is emitted via `context.writeSource()` so the cursor position maps back to the source, enabling attribute name completions in whitespace areas inside `define` blocks.
- **`experimentalGetLeftParenSourceRange`** — maps `(` tokens in `CallExpression`/`NewExpression` to their original source position for signature help support.

#### Mappings (`volar/mappings.ts`)

Defines the `VolarMappingResult` type and two `CodeInformation` constants:

- `DEFAULT_VOLAR_MAPPING_DATA` — all capabilities (completion, format, navigation, semantic, structure, verification)
- `VERIFICATION_ONLY_MAPPING_DATA` — verification only, used for diagnostic-position mappings (e.g., import errors pointing to top-of-file, required-attribute validation errors)

After `espolar` produces the initial `{ code, mappings }`, `applyReplacements()` expands the placeholder tagged templates and **adjusts the generated offsets** in the existing `CodeMapping[]` to account for the length differences between placeholders and their expanded type code. Extra diagnostic mappings (from `state.extraMappings`) are appended by searching for unique generated-code needle strings.

#### Runtime vs Volar Printers

| Pipeline                  | Printer   | Output                                                          |
| ------------------------- | --------- | --------------------------------------------------------------- |
| Runtime (`transpile`)     | `esrap`   | `{ code, sourceMap }` (source map v3, decoded from VLQ)         |
| IDE (`transpileForVolar`) | `espolar` | `{ code, mappings }` (Volar `CodeMapping[]`, produced natively) |

## Configuration for Language Tooling

Language tooling reads GTS configuration from the nearest `package.json` using `resolveGtsConfigSync()`. This determines which provider to use, which affects the ViewModel types available in completions. See [Configuration](/docs/configuration) for details.
