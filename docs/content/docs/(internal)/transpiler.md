---
title: Transpiler Internals
---

The transpiler (`@gi-tcg/gts-transpiler`) is the core of GTS. It converts `.gts` source into JavaScript (for execution) and TypeScript type declarations (for IDE support).

## Public API

```ts
// src/index.ts
function transpile(
  source: string,
  filename: string,
  option: TranspileOption,
): TranspileResult;
function transpileForVolar(
  source: string,
  filename: string,
  option: TranspileOption,
): VolarMappingResult;
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
    └── gtsToTypings(ast, option)  # GTS → TS type declarations
        ├── walker                 # Type-generating visitor (emits replacement placeholders)
        │       → Program (TS AST with __gts_replacement_tag placeholders)
        │
        ├── espolar print          # Print with embedded Volar CodeMapping[]
        │       → { code, mappings }
        │
        └── applyReplacements      # Expand placeholders → type code; adjust mapping offsets
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

| Node Type                       | Description                                          |
| ------------------------------- | ---------------------------------------------------- |
| `GTSDefineStatement`            | Top-level `define` block                             |
| `GTSNamedAttributeDefinition`   | Single attribute: name + body + optional binding     |
| `GTSAttributeBody`              | Positional attributes + optional named block         |
| `GTSPositionalAttributeList`    | Comma-separated list of positional expressions       |
| `GTSNamedAttributeBlock`        | `{ attrs... }` — nested attribute definitions        |
| `GTSDirectFunction`             | Function body inside a named block (starts with `:`) |
| `GTSShortcutFunctionExpression` | `:(expr)` or `:{stmts}`                              |
| `GTSShortcutArgumentExpression` | `:identifier` inside shortcuts                       |
| `GTSQueryExpression`            | `query *? expr`                                      |

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

1. Import of `{ createDefine, createBinding }` from the runtime
2. Import of the root ViewModel from the provider's `/vm` module

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

**`GTSQueryExpression`** → `__gts_fnArg["~query"](<arrow>)` or `__gts_fnArg["~queryAll"](<arrow>)` depending on whether the `*` syntax is used.

### TypeScript Erasure (`transform/erase_ts.ts`)

The `eraseTs()` function removes all TypeScript-specific syntax:

- Type annotations, type parameters, return types → deleted
- `TSAsExpression`, `TSSatisfiesExpression`, `TSNonNullExpression` → unwrap to inner expression
- `TSInterfaceDeclaration`, `TSTypeAliasDeclaration` → `EmptyStatement`
- Type-only imports/exports → removed
- `this` parameter in functions → removed
- Unsupported features (decorators, enums, namespaces, accessor fields) → throws `GtsTranspilerError`

### Printing (`transform/index.ts`)

The `transform()` function orchestrates the **runtime pipeline** and prints the final JS using `esrap` with source map generation:

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

## Error Handling

```ts
class GtsTranspilerError extends Error {
  position: SourceLocation | null;
}
```

Parse errors (from Acorn's `SyntaxError`) are caught and re-thrown as `GtsTranspilerError` with source location. Transform errors (unsupported TS features, invalid bindings) also use this class.

## Utilities

### Minimal Missing String (`utils/minimal_missing_string.ts`)

A suffix automaton-based utility that finds the shortest string NOT present in a given input. Uses BFS over a suffix automaton to find the minimal missing substring from a given alphabet. ~~Used internally for generating unique identifiers in validation.~~ Not used yet.
