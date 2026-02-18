---
title: Build Plugins
---

GTS provides build plugins for esbuild, Rollup, and Bun, plus a standalone TypeScript compiler CLI (`gtsc`).

## esbuild Plugin (`@gi-tcg/gts-esbuild-plugin`)

### Plugin Registration

```ts
import { gts } from "@gi-tcg/gts-esbuild-plugin";

// esbuild
await esbuild.build({
  plugins: [gts()],
  // ...
});
```

### Implementation (`src/index.ts`)

The `gts()` function returns a plugin compatible with both esbuild and Bun:

```ts
function gts(option: TranspileOption = {}): EsBuildPlugin & BunPlugin {
  return {
    name: "esbuild-plugin-gaming-ts",
    setup(build) {
      build.onLoad({ filter: /\.gts$/ }, async (args) => {
        const sourceCode = await readFile(args.path, "utf8");
        const resolvedOption = await resolveGtsConfig(args.path, option, {
          cwd: process.cwd(),
          readFileFn: readFile,
        });
        const { code, sourceMap } = transpile(sourceCode, args.path, resolvedOption);
        const mappingUrl = sourceMap.toUrl();
        return {
          contents: `${code}\n//# sourceMappingURL=${mappingUrl}`,
          loader: "js",
          resolveDir: path.dirname(args.path),
        };
      });
    },
  };
}
```

**Flow:**
1. Intercepts `.gts` file loads
2. Reads the source file
3. Resolves GTS configuration from the nearest `package.json`
4. Transpiles GTS → JS using `transpile()`
5. Appends an inline source map URL
6. Returns the result as JavaScript with `resolveDir` set for import resolution

### Bun Preload (`src/bun_preload.ts`)

For Bun's native plugin system:

```ts
import { gts } from "./index";
Bun.plugin(gts());
```

This is loaded via `bunfig.toml`:

```toml
preload = ["@gi-tcg/gts-esbuild-plugin/bun-preload"]
```

When `bun` starts, it automatically registers the GTS plugin, allowing direct `.gts` imports:

```ts
import { Barbara } from "./characters.gts";
```

## Rollup Plugin (`@gi-tcg/gts-rollup-plugin`)

### Plugin Registration

```ts
import { gts } from "@gi-tcg/gts-rollup-plugin";

export default {
  plugins: [gts()],
  // ...
};
```

### Implementation (`src/index.ts`)

```ts
function gts(option: TranspileOption = {}): Plugin {
  return {
    name: "rollup-plugin-gaming-ts",
    async load(id) {
      if (!id.endsWith(".gts")) return null;
      const sourceCode = await this.fs.readFile(id, { encoding: "utf8" });
      const resolvedOption = await resolveGtsConfig(id, option, {
        readFileFn: (path, encoding) => this.fs.readFile(path, { encoding }),
      });
      const { code, sourceMap } = transpile(sourceCode, id, resolvedOption);
      return { code, map: sourceMap };
    },
  };
}
```

**Differences from esbuild plugin:**
- Uses Rollup's `this.fs.readFile` instead of Node.js `fs`
- Returns the source map as an object (Rollup handles source map combination)
- No inline source map URL needed (Rollup manages this)

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
  shortcutFunctionPreludes?: string[]; // Default: element names
  queryBindings?: string[];          // Default: ["my", "opp"]
}
```

These options are merged with configuration from the nearest `package.json` (see [Configuration](/docs/configuration)). The merge priority is:

```
DEFAULT_GTS_CONFIG < package.json gamingTs < inline plugin option
```

## Source Maps

All build plugins generate source maps:

- **esbuild plugin** — inline data URL (appended as `//# sourceMappingURL=data:...`)
- **Rollup plugin** — returned as a separate map object (Rollup combines it with other source maps)
- **gtsc** — uses Volar mappings for error position mapping (not traditional source maps)

Source maps enable:
- Correct error positions in the original `.gts` file
- Debugger breakpoints in the source file
- Stack traces pointing to `.gts` lines
