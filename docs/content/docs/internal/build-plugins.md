---
title: Build Plugins
---

GTS provides a unified build plugin (`@gi-tcg/unplugin-gts`) that supports vite, esbuild, rollup, rolldown, rspack, webpack, and bun, plus a standalone TypeScript compiler CLI (`gtsc`).

## Unplugin (`@gi-tcg/unplugin-gts`)

The build plugin is built on [unplugin](https://unplugin.unjs.io/), providing a single plugin factory that adapts to multiple bundler APIs including Rollup, Rolldown, Vite, Webpack, Rspack, Bun and Unloader (Node.js loader).

### Bun Preload (`src/bun_preload.ts`)

For Bun's native plugin system, a preload script registers the plugin at startup via `bunfig.toml`:

```toml
preload = ["@gi-tcg/unplugin-gts/bun/preload"]
```

## gtsc type checker(`@gi-tcg/gtsc`)

A command-line TypeScript compiler with GTS support. Wraps Volar's `runTsc` with the GTS language plugin.

### Usage

```bash
npx gtsc --noEmit
```

## Build Plugin Configuration

See [Configuration](/docs/configuration).
