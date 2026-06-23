---
title: Configuration
---

GTS configuration determines how `.gts` files are transpiled — which runtime and provider packages to import, which symbols are available in shortcut functions, and which query bindings exist.

## Configuration Sources

Configuration is resolved from three sources (in order of priority):

```
Defaults  <  package.json "gamingTs" field  <  Inline options (plugin/API)
```

### 1. Defaults (`DEFAULT_GTS_CONFIG`)

```ts
const DEFAULT_GTS_CONFIG: Required<GtsConfig> = {
  runtimeImportSource: "@gi-tcg/gts-runtime",
  providerImportSource: "@gi-tcg/core/gts",
  shortcutFunctionPreludes: ["$"],
  queryBindings: ["my", "opp", "macros"],
};
```

### 2. package.json (`gamingTs` field)

Add a `gamingTs` field to the nearest `package.json`:

```json
{
  "name": "my-gts-project",
  "gamingTs": {
    "providerImportSource": "@example/provider",
    "runtimeImportSource": "@example/provider/runtime"
  }
}
```

The resolver walks up the directory tree from the source file to find the nearest `package.json` with a `gamingTs` field.

### 3. Inline Options

Passed directly to the transpiler API or build plugins:

```ts
import { gts } from "@gi-tcg/gts-esbuild-plugin";

const plugin = gts({
  runtimeImportSource: "@my-game/runtime",
  providerImportSource: "@my-game/provider",
});
```

## Configuration Fields

### `runtimeImportSource`

**Type:** `string`  
**Default:** `"@gi-tcg/gts-runtime"`

The module from which runtime functions are imported. The transpiler generates:

```ts
import { createDefine, createBinding, Action, Prelude } from "<runtimeImportSource>";
```

### `providerImportSource`

**Type:** `string`  
**Default:** `"@gi-tcg/core/gts"`

The module prefix for the provider. The transpiler generates:

```ts
import __gts_rootVm from "<providerImportSource>/vm";
```

The provider must export:
- `./vm` — default export of the root `ViewModel`

### `shortcutFunctionPreludes`

**Type:** `string[]`  
**Default:** `["$"]`

Names destructured from the `Prelude` symbol in shortcut functions. These become available as variables inside `:()` and `:{}` blocks:

```gts
// With default preludes:
:damage(hydro, 1);

// Transpiles to:
(__gts_fnArg, { cryo, hydro, pyro, electro, anemo, geo, dendro, omni } = __gts_fnArg[Prelude]) =>
  __gts_fnArg.damage(hydro, 1)
```

### `queryBindings`

**Type:** `string[]`  
**Default:** `["my", "opp", "macros"]`

Names destructured in query expression callbacks:

```gts
query my.character

// Transpiles to:
__gts_fnArg["~query"](({ my, opp }) => my.character)
```

## Resolution Algorithm

### `resolveGtsConfig(filePath, inlineConfig, options)`

**Async version** — used by build plugins (esbuild, Rollup).

### `resolveGtsConfigSync(filePath, inlineConfig, options)`

**Sync version** — used by the language plugin (Volar requires synchronous config resolution).

### Algorithm

Both use a generator-based implementation for shared logic:

```
1. Normalize the source file path to an absolute directory
2. Walk up the directory tree:
   a. Read package.json in the current directory
   b. Parse JSON and extract the "gamingTs" field
   c. If found, use it as the package config
   d. If not found, move to the parent directory
   e. Stop at the filesystem root or the configured stopDir
3. Merge: DEFAULT_GTS_CONFIG ← packageConfig ← inlineConfig
4. Return the fully resolved config
```

### Options

```ts
interface ResolveGtsConfigSyncOptions {
  readFileFn: (path: string, encoding: "utf8") => string;
  cwd?: string;
  stopDir?: string;
}

interface ResolveGtsConfigAsyncOptions {
  readFileFn: (path: string, encoding: "utf8") => Promise<string>;
  cwd?: string;
  stopDir?: string;
}
```

- `readFileFn` — file reading function (allows the caller to use Node.js `fs`, TypeScript's `sys`, or Rollup's `this.fs`)
- `cwd` — current working directory (for resolving relative paths)
- `stopDir` — stop walking up the directory tree at this directory

## Example: Provider Setup

A typical GTS project has this structure:

```
my-game/
├── package.json          # Root workspace
├── packages/
│   ├── provider/
│   │   ├── package.json  # No gamingTs field needed
│   │   ├── vm.ts         # Root ViewModel (default export)
│   │   └── runtime.ts    # Re-exports @gi-tcg/gts-runtime
│   └── cards/
│       ├── package.json  # { "gamingTs": { "providerImportSource": "@my-game/provider" } }
│       └── barbara.gts   # Card definitions
```

The `provider/package.json` must export the correct subpaths:

```json
{
  "name": "@my-game/provider",
  "exports": {
    "./vm": "./vm.ts",
    "./runtime": "./runtime.ts"
  }
}
```
