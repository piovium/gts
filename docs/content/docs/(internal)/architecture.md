---
title: Architecture
---

## Monorepo Structure

GTS is a monorepo managed with **pnpm** (workspaces defined in the root `package.json`). Each package uses [tsdown](https://tsdown.dev) for building, with the root `pnpm build` command orchestrating builds in dependency order via `pnpm -r build`.

```
gts/
├── packages/
│   ├── transpiler/          # Core: parse .gts → transform → emit JS
│   ├── runtime/             # Runtime library (ViewModel, createDefine, createBinding)
│   ├── language-plugin/     # Volar language plugin (virtual code generation)
│   ├── language-server/     # LSP server (Node.js + browser entry points)
│   ├── unplugin/            # Build plugin (vite, esbuild, rollup, rspack, webpack, bun)
│   ├── tsc/                 # CLI: gtsc (TypeScript compiler with GTS support)
│   ├── typescript-language-service-plugin/  # TS Language Service Plugin (CJS)
│   └── vscode/              # VS Code extension (syntax, LSP client)
├── examples/
│   ├── local/               # Dev testing with .gts files
│   ├── provider/            # Example provider (ViewModel definitions)
│   └── web/                 # Vite + web example
└── package.json             # Root workspace definition
```

## Package Map

| Package | npm Name | Format | Target | Purpose |
|---------|----------|--------|--------|---------|
| transpiler | `@gi-tcg/gts-transpiler` | ESM | browser | Core compilation engine |
| runtime | `@gi-tcg/gts-runtime` | ESM | browser | Runtime library for execution |
| language-plugin | `@gi-tcg/gts-language-plugin` | ESM | browser | Volar virtual code provider |
| language-server | `@gi-tcg/gts-language-server` | ESM | node+browser | Full LSP implementation |
| unplugin | `@gi-tcg/unplugin-gts` | ESM | browser | Multi-bundler build plugin (vite, esbuild, rollup, rspack, webpack, bun) |
| tsc | `@gi-tcg/gtsc` | ESM | node | CLI compiler wrapper |
| ts-ls-plugin | `@gi-tcg/gts-typescript-language-service-plugin` | CJS | node | TS editor plugin |
| vscode | `gts-vscode` (private) | CJS | node | VS Code extension |

## Dependency Graph

```
                        ┌──────────────┐
                        │  transpiler  │
                        └──────┬───────┘
                               │ used by
         ┌───────────┬─────────┴─┬────────┬───────────┐
         │           │           │        │           │
   ┌─────┴─────┐ ┌───┴────┐ ┌────┴───┐ ┌──┴───┐  ┌────┴─────┐
   │  esbuild  │ │unplugin│ │language│ │ tsc  │  │ language │
   │  plugin   │ │        │ │ plugin │ │(gtsc)│  │  server  │
   └───────────┘ └────────┘ └────┬───┘ └───┬──┘  └────┬─────┘
                                 │         │          │
                                 │    uses language-plugin
                                 │         │          │
                                 └─────────┼──────────┘
                                           │
                              ┌────────────┴──────────────┐
                              │ ts-language-service-plugin│
                              └────────────┬──────────────┘
                                           │
                              ┌────────────┴──────────────┐
                              │     vscode extension      │
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

### tsdown (Package Bundler)

Each package uses [tsdown](https://tsdown.dev) as its bundler, configured in a per-package `tsdown.config.ts`. The root `pnpm build` runs `pnpm -r build`, which executes each package's `build` script (typically `tsdown`) in dependency order.

## External Dependencies

### Transpiler Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `acorn` | 8.16.0 | JavaScript parser (base) |
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
