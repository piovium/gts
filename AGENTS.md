# Agent Instructions for GamingTS (GTS) Repository

GamingTS (GTS) is a TypeScript-based DSL toolchain for Genshin Impact TCG card definitions. It is a pnpm monorepo.

## 1. Environment & Build

- **Package manager:** pnpm (`packageManager: pnpm@11.0.8`). Do NOT use npm/yarn/bun.
- **Node.js:** >= 26 (see `engines` in root `package.json`).
- **Setup:**
  ```bash
  pnpm install
  ```
- **Build:**
  - Root build: `pnpm build` (runs `pnpm -r build` — builds all packages in dependency order).
  - Each package uses **tsdown** as the bundler (not tsup, not rolldown directly).
  - Some packages need extra flags, e.g.:
    - `packages/tsc`: `tsdown --no-dts --no-fixed-extension`
    - `packages/typescript-language-service-plugin`: `tsdown --format=cjs --no-dts --no-fixed-extension`

## 2. Testing

- **Test runner:** vitest (version pinned in root `dependencies`).
- **Test files:** `__tests__/**/*.test.ts` inside each package, plus `examples/local/import.test.ts`.
- **Test imports:** `import { test, expect } from "vitest"`.
- **Running tests:**
  ```bash
  pnpm vitest                        # all tests from root
  pnpm vitest --run                  # single run (no watch)
  pnpm vitest <file>                 # run a specific file
  pnpm vitest -t "test name"         # filter by test name
  ```
  Without vitest in PATH, use `pnpm exec vitest ...`.
- There is no `vitest.config.ts` — vitest auto-discovers test files and uses inline config from `examples/local/vite.config.ts` for GTS import support.

## 3. Code Style & Conventions

- **Language:** TypeScript, strict mode (`"strict": true` in all `tsconfig.json`).
- **Indent:** 2 spaces (see `.editorconfig`).
- **Semicolons:** required.
- **Quotes:** double quotes (`"`) preferred.
- **Module system:** ESM for all packages **except** `packages/vscode` and `packages/typescript-language-service-plugin` which are `"type": "commonjs"`.
- **Imports:**
  - Use ESM `import`/`export`.
  - Workspace deps use the `workspace:*` protocol (e.g., `"@gi-tcg/gts-transpiler": "workspace:*"`).
  - `tsconfig` uses `"module": "NodeNext"` and `"verbatimModuleSyntax": true` in most packages; `"module": "Node16"` in the vscode package.
- **Naming:**
  - Packages: `@gi-tcg/gts-<name>` (except `gts-vscode` and `@gi-tcg/unplugin-gts`).
  - Files: snake_case or kebab-case.
  - Classes/Types: PascalCase.
  - Variables/Functions: camelCase.
- **No lint/format/typecheck scripts are defined** in any `package.json`.

## 4. Architecture

| Package | Scope | Notable |
|---|---|---|
| `packages/transpiler` | Core: parse `.gts` → AST → transform → `{ code, sourceMap }` | Entry: `src/index.ts`. Uses acorn + esrap. |
| `packages/language-plugin` | Volar language plugin for `.gts` | Depends on `@volar/language-core`. |
| `packages/tsc` | Custom TSC wrapper (`gtsc`) that supports `.gts` | Uses `@volar/typescript`. |
| `packages/language-server` | LSP server (node + browser) | Uses Volar framework; bin: `gts-language-server`. |
| `packages/vscode` | VS Code extension | CJS only; language ID `gaming-ts`, extension `.gts`; packaged with `vsce`. |
| `packages/unplugin` | Bundler plugin (vite, esbuild, rollup, rspack, webpack, bun) | Entry points per bundler under `./vite`, `./esbuild`, etc. |
| `packages/typescript-language-service-plugin` | TS language service plugin for VS Code | CJS; injected via `typescriptServerPlugins` in the VS Code extension. |
| `packages/runtime` | Runtime helpers for generated code | Thin, mostly type definitions. |

### Key patterns:
- **Transpiler pipeline:** `parse(source)` → AST → `transform(ast, options, context)` → `{ code, sourceMap }`. The public API is `transpile()` and `transpileForVolar()` in `packages/transpiler/src/index.ts`.
- **Config:** GTS options are resolved from the nearest `package.json`'s `gamingTs` field. See `packages/transpiler/src/config.ts`. Defaults include `runtimeImportSource`, `providerImportSource`, and `shortcutFunctionPreludes`.
- **Volar integration:** The language plugin, language server, and tsc all depend on `@volar/*` packages for `.gts` language support in editors.

## 5. Workflow

- **Dependencies:** Do not add external dependencies unless absolutely necessary; prefer Node.js built-ins.
- **When working on transpiler**, start at `packages/transpiler/src/index.ts` for the public API.
- **When changing vscode extension**, rebuild with `pnpm build` in `packages/vscode`, then use the VS Code launch config in `.vscode/launch.json`.
