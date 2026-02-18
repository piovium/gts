---
title: Architecture
---

## Monorepo Structure

GTS is a monorepo managed with **Bun** (workspaces defined in the root `package.json`). The build orchestration is handled by [bunup](https://github.com/nicepkg/bunup), configured in `bunup.config.ts`.

```
gts/
├── packages/
│   ├── transpiler/          # Core: parse .gts → transform → emit JS
│   ├── runtime/             # Runtime library (ViewModel, createDefine, createBinding)
│   ├── language-plugin/     # Volar language plugin (virtual code generation)
│   ├── language-server/     # LSP server (Node.js + browser entry points)
│   ├── esbuild-plugin/      # esbuild/Bun plugin for .gts files
│   ├── rollup-plugin/       # Rollup plugin for .gts files
│   ├── tsc/                 # CLI: gtsc (TypeScript compiler with GTS support)
│   ├── typescript-language-service-plugin/  # TS Language Service Plugin (CJS)
│   └── vscode/              # VS Code extension (syntax, LSP client)
├── examples/
│   ├── local/               # Dev testing with .gts files
│   ├── provider/            # Example provider (ViewModel definitions)
│   └── web/                 # Vite + web example
├── bunup.config.ts          # Build configuration for all packages
├── bunfig.toml              # Bun config (preloads GTS esbuild plugin)
└── package.json             # Root workspace definition
```

## Package Map

| Package | npm Name | Format | Target | Purpose |
|---------|----------|--------|--------|---------|
| transpiler | `@gi-tcg/gts-transpiler` | ESM | browser | Core compilation engine |
| runtime | `@gi-tcg/gts-runtime` | ESM | browser | Runtime library for execution |
| language-plugin | `@gi-tcg/gts-language-plugin` | ESM | browser | Volar virtual code provider |
| language-server | `@gi-tcg/gts-language-server` | ESM | node+browser | Full LSP implementation |
| esbuild-plugin | `@gi-tcg/gts-esbuild-plugin` | ESM | node | esbuild/Bun build plugin |
| rollup-plugin | `@gi-tcg/gts-rollup-plugin` | ESM | browser | Rollup build plugin |
| tsc | `@gi-tcg/gtsc` | ESM | node | CLI compiler wrapper |
| ts-ls-plugin | `@gi-tcg/gts-typescript-language-service-plugin` | CJS | node | TS editor plugin |
| vscode | `gts-vscode` (private) | CJS | node | VS Code extension |

## Dependency Graph

```
                        ┌──────────────┐
                        │  transpiler  │
                        └──────┬───────┘
                               │ used by
            ┌──────────┬───────┼───────────┬────────────┐
            │          │       │           │            │
      ┌─────┴─────┐ ┌──┴──┐ ┌─┴──────┐ ┌──┴───┐  ┌────┴─────┐
      │  esbuild  │ │rollup│ │language │ │ tsc  │  │ language │
      │  plugin   │ │plugin│ │ plugin  │ │(gtsc)│  │  server  │
      └───────────┘ └─────┘ └────┬────┘ └──┬───┘  └────┬─────┘
                                 │         │            │
                                 │    uses language-plugin
                                 │         │            │
                                 └─────────┼────────────┘
                                           │
                              ┌────────────┴──────────────┐
                              │  ts-language-service-plugin │
                              └────────────┬──────────────┘
                                           │
                              ┌────────────┴──────────────┐
                              │     vscode extension       │
                              └───────────────────────────┘

      ┌──────────┐
      │ runtime  │  (standalone — consumed by user code at runtime)
      └──────────┘
```

**Key relationships:**
- **transpiler** is the foundational package; all build plugins and language tools depend on it.
- **language-plugin** wraps the transpiler's Volar output into a Volar `LanguagePlugin` — used by the language server, `gtsc`, and the TS language service plugin.
- **runtime** is independent and only consumed by the generated JavaScript at execution time.

## Build System

### bunup (Build Orchestrator)

The root `bunup.config.ts` defines workspaces with individual build configs:

```ts
export default defineWorkspace([
  { name: "transpiler", root: "packages/transpiler" },
  { name: "runtime", root: "packages/runtime" },
  { name: "esbuild-plugin", root: "packages/esbuild-plugin", config: { target: "node" } },
  { name: "rollup-plugin", root: "packages/rollup-plugin", config: { target: "browser" } },
  { name: "language-plugin", root: "packages/language-plugin", config: { target: "browser" } },
  { name: "language-server", root: "packages/language-server", config: [
    { name: "node", entry: "src/node.ts", target: "node", outDir: "dist/node" },
    { name: "browser", entry: "src/browser.ts", target: "browser", outDir: "dist/browser" },
  ]},
  { name: "tsc", root: "packages/tsc", config: { target: "node", dts: false } },
  { name: "ts-ls-plugin", root: "packages/typescript-language-service-plugin",
    config: { target: "node", format: "cjs", dts: false } },
  { name: "vscode", root: "packages/vscode",
    config: { entry: ["src/extension.ts", "src/server.ts"], target: "node",
              format: "cjs", dts: false, packages: "bundle" } },
], { outDir: "dist", format: "esm", target: "browser", conditions: ["bun"], packages: "external" });
```

Default output format is ESM targeting browser. Individual packages override as needed (CJS for VS Code/TS plugin, node for CLI tools).

### Bun Preloading

The root `bunfig.toml` preloads the esbuild plugin so that `.gts` files can be imported directly when running with `bun`:

```toml
preload = ["@gi-tcg/gts-esbuild-plugin/bun-preload"]
```

This calls `Bun.plugin(gts())` at startup, registering a loader for `.gts` files.

## External Dependencies

### Transpiler Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `acorn` | 8.15.0 | JavaScript parser (base) |
| `@sveltejs/acorn-typescript` | — | TypeScript syntax plugin for Acorn |
| `esrap` | 2.2.1 | AST printer with source map support |
| `zimmerframe` | 1.1.4 | AST walker/visitor framework |
| `magic-string` | 0.30.21 | Source map generation |
| `@jridgewell/sourcemap-codec` | — | VLQ source map decoding |

### Language Tooling Dependencies

| Package | Purpose |
|---------|---------|
| `@volar/language-core` | Volar virtual code and language plugin interfaces |
| `@volar/language-server` | LSP server framework |
| `@volar/typescript` | TypeScript integration for Volar |
| `volar-service-typescript` | TypeScript language service for Volar |
| `vscode-uri` | URI handling for VS Code/LSP |

## Publishing

The `scripts/publish.ts` script validates consistency across all 8 public packages (version, repository, license) and publishes each to npm with `--access public`. Current version: `0.2.0`.
