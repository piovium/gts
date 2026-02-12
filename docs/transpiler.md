# Transpiler Internals

The transpiler (`@gi-tcg/gts-transpiler`) is the core of GTS. It converts `.gts` source into JavaScript (for execution) and TypeScript type declarations (for IDE support).

## Public API

```ts
// src/index.ts
function transpile(source: string, filename: string, option: TranspileOption): TranspileResult;
function transpileForVolar(source: string, filename: string, option: TranspileOption): VolarMappingResult;
```

- **`transpile`** — full pipeline for runtime: parse → GTS-to-TS → erase TS → print JS + source map
- **`transpileForVolar`** — IDE pipeline: loose parse → GTS-to-typings → replacement pass → Volar mappings

## Pipeline Overview

### Runtime Pipeline (`transpile`)

```
Source (.gts)
    │
    ├── parse(source)              # Strict parser (Acorn + TS + GTS plugins)
    │       → Program (AST)
    │
    ├── gtsToTs(ast, option)       # GTS AST nodes → TS function calls
    │       → Program (TS AST)
    │
    ├── eraseTs(ast)               # Remove type annotations
    │       → Program (JS AST)
    │
    └── print(ast)                 # esrap printer → code + source map
            → { code, sourceMap }
```

### IDE Pipeline (`transpileForVolar`)

```
Source (.gts)
    │
    ├── parseLoose(source)         # Tolerant parser (with dummy tokens)
    │       → Program (AST)
    │
    ├── collectLeafTokens(ast)     # Extract leaf nodes for mapping
    │       → LeafToken[]
    │
    ├── gtsToTypings(ast, option)  # GTS → TS type declarations
    │   ├── walker                 # Type-generating visitor
    │   ├── esrap print            # Print with patched printer
    │   └── applyReplacements      # Expand type placeholders
    │       → { code, sourceMap }
    │
    └── convertToVolarMappings     # Source map → Volar CodeMapping[]
            → { code, mappings }
```

## Parsing (`src/parse/`)

### Parser Stack

The parser is built by extending Acorn with plugins (applied via `Parser.extend()`):

```
Acorn Base Parser
    └── @sveltejs/acorn-typescript    # TypeScript syntax support
        └── loosePlugin()             # Error-tolerant parsing (IDE only)
            └── recordCallLParenPlugin()  # Record `(` location (IDE only)
                └── gtsPlugin()       # GTS grammar extensions
```

### `gtsPlugin` (`parse/gts_plugin.ts`)

Extends the Acorn parser class (`GtsParser`) with GTS-specific grammar:

**Overridden methods:**
- `parseStatement()` — intercepts `define` at top level to parse `GTSDefineStatement`
- `parseExprAtom()` — handles `:identifier` for `GTSShortcutArgumentExpression`
- `parseMaybeUnary()` — handles `query` keyword for `GTSQueryExpression`

**New methods:**
- `gts_isDefineStatement()` — checks for `define` followed by no line break
- `gts_parseNamedAttributeDefinition()` — parses `AttributeName AttributeBody BindingClause? ;`
- `gts_parseAttributeBody()` — parses `PositionalAttributeList? NamedAttributeBlock?`
- `gts_parsePositionalAttributeList()` — comma-separated expressions (stops at `{`, `;`, `as`)
- `gts_parseNamedAttributeBlock()` — `{ NamedAttributeDefinition* DirectFunction? }`
- `gts_parseDirectFunction()` — statements inside a block that starts with `:` or a reserved word
- `gts_parseAttributeExpression()` — either `:ShortcutFunction` or a primary expression
- `gts_parseShortcutFunction()` — `:(expr)` or `:{stmts}`
- `gts_parseQueryExpression()` — `query *? UnaryExpression`

**Plugin options:**
- `allowEmptyShortcutMember` — permits `:` without an identifier (for IDE completion)
- `allowEmptyPositionalAttribute` — permits empty positional slots (for IDE completion)

### `loosePlugin` (`parse/loose_plugin.ts`)

Error-tolerant parsing for language tooling. Uses a `Proxy` to intercept `parseIdent()` calls — when the parser expects an identifier but finds a different token, it creates a **dummy identifier** (`✖`) with `isDummy: true` instead of throwing.

This ensures the parser produces a valid AST even for incomplete code, which is essential for editor features like autocompletion.

### `recordCallLParenPlugin` (`parse/record_call_lparen_plugin.ts`)

Records the source location of the `(` token in `CallExpression` and `NewExpression` nodes (stored as `lParenLoc`). This enables signature help in the language server — when the user types `(`, the LSP can find the corresponding function call and show parameter hints.

### GTS AST Node Types (`src/types.ts`)

The parser produces these custom AST nodes (extending estree):

| Node Type | Description |
|-----------|-------------|
| `GTSDefineStatement` | Top-level `define` block |
| `GTSNamedAttributeDefinition` | Single attribute: name + body + optional binding |
| `GTSAttributeBody` | Positional attributes + optional named block |
| `GTSPositionalAttributeList` | Comma-separated list of positional expressions |
| `GTSNamedAttributeBlock` | `{ attrs... }` — nested attribute definitions |
| `GTSDirectFunction` | Function body inside a named block (starts with `:`) |
| `GTSShortcutFunctionExpression` | `:(expr)` or `:{stmts}` |
| `GTSShortcutArgumentExpression` | `:identifier` inside shortcuts |
| `GTSQueryExpression` | `query *? expr` |

## Transformation (`src/transform/`)

### GTS → TypeScript (`transform/gts.ts`)

The `gtsToTs()` function walks the AST with `zimmerframe` and replaces GTS nodes with standard JS/TS nodes.

#### TranspileState

The visitor maintains a `TranspileState` that tracks:
- Generated identifiers (`__gts_createDefine`, `__gts_createBinding`, `__gts_Action`, etc.)
- Shortcut function parameters (destructured prelude symbols)
- Query parameters (destructured query bindings)
- Externalized bindings (variables to export from `as` clauses)
- A counter for generating unique node variable names

#### Visitor Transformations

**`Program`** — Wraps the body with:
1. Import of `{ createDefine, createBinding, Action, Prelude }` from the runtime
2. Import of the root ViewModel from the provider's `/vm` module
3. Conditional import of the query function from the provider's `/query` module

**`GTSDefineStatement`** → Expands into:
```js
const __gts_node_0 = <visited attribute body>;
const __gts_bindings_0 = __gts_createBinding(__gts_rootVm, __gts_node_0);
export const Barbara = __gts_bindings_0[0];  // for each binding
__gts_createDefine(__gts_rootVm, __gts_node_0);
```

**`GTSNamedAttributeDefinition`** → Object literal:
```js
{ name: "id", positionals: () => [1201], named: null, binding: "public" }
```

**`GTSAttributeBody`** → Object with `positionals` (lazy arrow function returning array) and `named` (null or object).

**`GTSPositionalAttributeList`** → Array expression. Lowercase identifiers become string literals; others are visited as expressions.

**`GTSNamedAttributeBlock`** → Object with `attributes` array.

**`GTSDirectFunction`** → Object with `name: Action`, `positionals: () => [arrow function]`, `named: null`.

**`GTSShortcutFunctionExpression`** → Arrow function with shortcut parameters.

**`GTSShortcutArgumentExpression`** → `__gts_fnArg.property` member expression.

**`GTSQueryExpression`** → `__gts_query(({ my, opp }) => <expr>, { star: true/false })`.

### TypeScript Erasure (`transform/erase_ts.ts`)

The `eraseTs()` function removes all TypeScript-specific syntax:

- Type annotations, type parameters, return types → deleted
- `TSAsExpression`, `TSSatisfiesExpression`, `TSNonNullExpression` → unwrap to inner expression
- `TSInterfaceDeclaration`, `TSTypeAliasDeclaration` → `EmptyStatement`
- Type-only imports/exports → removed
- `this` parameter in functions → removed
- Unsupported features (decorators, enums, namespaces, accessor fields) → throws `GtsTranspilerError`

### Printing (`transform/index.ts`)

The `transform()` function orchestrates the pipeline and prints the final JS using `esrap` with source map generation:

```ts
function transform(ast, option, sourceInfo): TranspileResult {
  const ts = gtsToTs(ast, option);
  const js = eraseTs(ts);
  const { code, map } = print(js, jsPrinter(), {
    indent: "  ",
    sourceMapContent: sourceInfo.content,
    sourceMapSource: sourceInfo.filename,
  });
  return { code, sourceMap: map };
}
```

## Volar Transform (`src/transform/volar/`)

The Volar transform generates TypeScript type declarations for IDE features. Instead of producing runnable code, it generates type-level constructs that let TypeScript's type checker validate GTS definitions.

### Overview

The Volar pipeline differs from the runtime pipeline:
1. Uses a **typing walker** instead of the runtime visitor
2. Generates **type aliases and typed variables** instead of function calls
3. Uses a **replacement system** for complex type constructs
4. Produces **Volar CodeMappings** instead of plain source maps

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
- `genBindingTyping(state, info)` — generates a type for a binding export (the `as` clause).

### Replacement System (`volar/replacements.ts`)

Complex type constructs can't be expressed directly in the AST. Instead, the walker emits **placeholder tagged template expressions**:

```js
__gts_replacement_tag`{"type":"enterVMFromRoot","vm":"__root_vm",...}`
```

After printing, `applyReplacements()` regex-replaces these with actual TypeScript type code. For example, `enterVMFromRoot` becomes:

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

### Leaf Token Collection (`volar/collect_tokens.ts`)

Before transformation, `collectLeafTokens()` walks the AST and collects all leaf nodes (nodes with no child AST nodes). Each `LeafToken` stores:
- `loc` — source location
- `isDummy` — whether this is a dummy identifier from loose parsing
- `sourceLength` / `sourceLengthOffset` — overrides for mapping length
- `startOffset` — adjusts the generated code start position
- `generatedLength` — overrides the generated code length

These tokens drive the source-to-generated mapping conversion.

### Patched Printer (`volar/printer.ts`)

The esrap printer is patched for Volar output:

1. **Dummy identifiers** print as empty string (or `,` if it's the last argument, to preserve TypeScript error detection)
2. **CallExpression/NewExpression** — the `(` token is mapped to the `lParenLoc` node for signature help support. Uses a `Proxy` to intercept `context.write("(")` and associate it with the fake location node.

### Volar Mappings (`volar/mappings.ts`)

`convertToVolarMappings()` converts the esrap source map into Volar `CodeMapping[]`:

1. Decodes the VLQ source map with `@jridgewell/sourcemap-codec`
2. Builds a source-to-generated position lookup map
3. For each leaf token, finds the generated position and creates a `CodeMapping` with:
   - `sourceOffsets` / `generatedOffsets` — byte offsets
   - `lengths` / `generatedLengths` — mapped region sizes
   - `data` — Volar code information flags (completion, navigation, verification, etc.)
4. Special handling for dummy tokens (adjusts source start to include whitespace before the dummy)
5. Processes additional mappings from the walker (e.g., attribute name → typed variable access)

## Error Handling

```ts
class GtsTranspilerError extends Error {
  position: SourceLocation | null;
}
```

Parse errors (from Acorn's `SyntaxError`) are caught and re-thrown as `GtsTranspilerError` with source location. Transform errors (unsupported TS features, invalid bindings) also use this class.

## Utilities

### Minimal Missing String (`utils/minimal_missing_string.ts`)

A suffix automaton-based utility that finds the shortest string NOT present in a given input. Uses BFS over a suffix automaton to find the minimal missing substring from a given alphabet. Used internally for generating unique identifiers in validation.
