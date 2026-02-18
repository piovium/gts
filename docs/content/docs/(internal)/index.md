---
title: Introduction
---

> Internal developer documentation for the GamingTS toolchain — a domain-specific language extension for TypeScript, designed for writing Genshin Impact TCG (Genius Invokation) card definitions.

## Documentation Index

| Document | Description |
|----------|-------------|
| [Architecture](./architecture.md) | Monorepo structure, package map, dependency graph, and build system |
| [GTS Syntax](./gts-syntax.md) | Language syntax reference with formal grammar and examples |
| [Transpiler](./transpiler.md) | Transpiler internals: parsing, AST, transformation pipeline |
| [Runtime](./runtime.md) | Runtime system: ViewModel, bindings, define/query execution |
| [Language Tooling](./language-tooling.md) | Volar integration, language server, VS Code extension, and TypeScript plugin |
| [Build Plugins](./build-plugins.md) | esbuild, Rollup, and Bun plugins, plus `gtsc` CLI compiler |
| [Configuration](./configuration.md) | Configuration resolution, `package.json` fields, and defaults |

## How GTS Works (Summary)

GTS (GamingTS) extends TypeScript with a declarative DSL for defining game entities (characters, skills, summons). A `.gts` file can contain both standard TypeScript and GTS `define` statements. The toolchain:

1. **Parses** `.gts` source using an extended Acorn parser (with TypeScript and GTS grammar plugins)
2. **Transforms** the GTS-specific AST nodes into standard TypeScript/JavaScript function calls
3. **Erases** TypeScript type annotations to produce plain JavaScript
4. **Prints** the output with source maps using `esrap`

For IDE support, a parallel Volar-based pipeline generates TypeScript type declarations with precise source-to-generated code mappings, enabling completions, diagnostics, and navigation in editors.

```
┌─────────────────────────────────────────────────────────────┐
│                       .gts Source File                       │
└─────────────────────┬───────────────────────────────────────┘
                      │
         ┌────────────┴────────────┐
         │      Acorn Parser       │
         │  + TypeScript Plugin    │
         │  + GTS Grammar Plugin   │
         │  + Loose Plugin (IDE)   │
         └────────────┬────────────┘
                      │
              Extended AST (estree + GTS nodes)
                      │
         ┌────────────┴────────────────────────────┐
         │                                         │
    Runtime Path                            IDE / Volar Path
         │                                         │
  ┌──────┴──────┐                      ┌───────────┴──────────┐
  │ GTS → TS    │                      │ GTS → TypeScript     │
  │ Transform   │                      │ Typings (Volar)      │
  └──────┬──────┘                      └───────────┬──────────┘
         │                                         │
  ┌──────┴──────┐                      ┌───────────┴──────────┐
  │ TS Erasure  │                      │ Replacement Pass     │
  └──────┬──────┘                      └───────────┬──────────┘
         │                                         │
  ┌──────┴──────┐                      ┌───────────┴──────────┐
  │ esrap Print │                      │ Volar Mappings       │
  │ + SourceMap │                      │ (CodeMapping[])      │
  └──────┬──────┘                      └───────────┬──────────┘
         │                                         │
     .js output                            Language Server
     (bundlers, CLI)                      (completions, etc.)
```

## Quick Start for Contributors

```bash
# Install dependencies (use bun, not npm/yarn/pnpm)
bun install

# Build all packages
bun run build

# Run transpiler tests
bun test packages/transpiler/__tests__/transpile.test.ts

# Run all tests
bun test
```
