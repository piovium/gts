---
title: Configuration
---

GTS configuration determines how `.gts` files are transpiled — which runtime and provider packages to import.

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
import { createDefine, createBinding } from "<runtimeImportSource>";
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

## `package.json` Resolution

### API: `resolveGtsConfig(filePath, inlineConfig, options)`

**Async version** — used by most of build plugins (esbuild, Rollup).

### API: `resolveGtsConfigSync(filePath, inlineConfig, options)`

**Sync version** — used by the language plugin and Node.js unloader (both require sync operation on transpilation).
