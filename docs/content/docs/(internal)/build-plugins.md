---
title: Build Plugins
---

GTS provides a unified build plugin (`@gi-tcg/unplugin-gts`) that supports vite, esbuild, rollup, rolldown, rspack, webpack, and bun, plus a standalone TypeScript compiler CLI (`gtsc`).

## Unplugin (`@gi-tcg/unplugin-gts`)

The build plugin is built on [unplugin](https://unplugin.unjs.io/), providing a single plugin factory that adapts to multiple bundler APIs. Import the bundler-specific entry point:

```ts
// vite
import gts from "@gi-tcg/unplugin-gts/vite";

// esbuild
import gts from "@gi-tcg/unplugin-gts/esbuild";

// rollup
import gts from "@gi-tcg/unplugin-gts/rollup";

// webpack
import gts from "@gi-tcg/unplugin-gts/webpack";

// rspack
import gts from "@gi-tcg/unplugin-gts/rspack";

// rolldown
import gts from "@gi-tcg/unplugin-gts/rolldown";

// bun
import gts from "@gi-tcg/unplugin-gts/bun";

// generic (createUnplugin)
import gts from "@gi-tcg/unplugin-gts";
```

### Implementation (`src/unplugin.ts`)

The `unpluginFactory` function transforms `.gts` files using the `transpile()` API:

```ts
import {
  transpile,
  type TranspileOption,
  resolveGtsConfig,
} from "@gi-tcg/gts-transpiler";
import type { UnpluginFactory } from "unplugin";

export const unpluginFactory: UnpluginFactory<TranspileOption | undefined> = (option) => {
  return {
    name: "unplugin-gaming-ts",
    transform: {
      filter: { id: /\.gts$/ },
      async handler(source, id) {
        const resolvedOption = await resolveGtsConfig(id, option ?? {}, {
          readFileFn: (path, encoding) =>
            this.fs.readFile(path, { encoding }) as Promise<string>,
        });
        const { code, sourceMap } = transpile(source, id, resolvedOption);
        return { code, map: sourceMap };
      },
    },
  };
};
```

**Flow:**
1. Intercepts `.gts` file loads via the `transform` hook
2. Resolves GTS configuration from the nearest `package.json`
3. Transpiles GTS → JS using `transpile()`
4. Returns the generated JavaScript and source map (each bundler handles source maps natively)

### Bun Preload (`src/bun_preload.ts`)

For Bun's native plugin system, a preload script registers the plugin at startup:

```ts
/// <reference types="bun" />
import gts from "./bun.ts";

await Bun.plugin(gts());
```

Users can configure it via `bunfig.toml`:

```toml
preload = ["@gi-tcg/unplugin-gts/bun/preload"]
```

## gtsc CLI Compiler (`@gi-tcg/gtsc`)

A command-line TypeScript compiler with GTS support. Wraps Volar's `runTsc` with the GTS language plugin.

### Usage

```bash
npx gtsc --project tsconfig.json
```

### Implementation (`src/index.ts`)

```ts
import { runTsc } from "@volar/typescript/lib/quickstart/runTsc.js";
import { createGtsLanguagePlugin } from "@gi-tcg/gts-language-plugin";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const tscPath = require.resolve("typescript/lib/tsc");
runTsc(tscPath, [".gts"], (ts, options) => {
  const gtsLanguagePlugin = createGtsLanguagePlugin(ts);
  return { languagePlugins: [gtsLanguagePlugin] };
});
```

**How it works:**
1. Resolves the path to TypeScript's `tsc` module
2. Calls `runTsc` with `.gts` as an additional file extension
3. Provides the GTS language plugin, which handles `.gts` files by:
   - Generating virtual TypeScript code via `transpileForVolar`
   - Providing type information through Volar mappings
4. TypeScript's type checker runs on the generated code, reporting errors mapped back to source positions

### Configuration

The `gtsc` binary is exposed via `package.json`:

```json
{
  "bin": {
    "gtsc": "bin/gtsc.js"
  }
}
```

Where `bin/gtsc.js` is:
```js
#!/usr/bin/env node
import "../dist/index.js";
```

## Build Plugin Configuration

All build plugins accept an optional `TranspileOption`:

```ts
interface TranspileOption {
  runtimeImportSource?: string;      // Default: "@gi-tcg/gts-runtime"
  providerImportSource?: string;     // Default: "@gi-tcg/core/gts"
}
```

These options are merged with configuration from the nearest `package.json` (see [Configuration](/docs/configuration)). The merge priority is:

```
DEFAULT_GTS_CONFIG < package.json gamingTs < inline plugin option
```

## Source Maps

All build plugins generate source maps:

- **Unplugin** — returns a source map object; each bundler handles it natively (inline data URL for esbuild, combined map for rollup, etc.)
- **gtsc** — uses Volar mappings for error position mapping (not traditional source maps)

Source maps enable:
- Correct error positions in the original `.gts` file
- Debugger breakpoints in the source file
- Stack traces pointing to `.gts` lines
