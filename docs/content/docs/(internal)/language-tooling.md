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
- GTS-specific keywords (`define`, `query`)
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
2. The language plugin transpiles the source to TypeScript with Volar mappings
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

## Configuration for Language Tooling

Language tooling reads GTS configuration from the nearest `package.json` using `resolveGtsConfigSync()`. This determines which provider to use, which affects the ViewModel types available in completions. See [Configuration](/docs/configuration) for details.
