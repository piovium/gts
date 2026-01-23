# Agent Instructions for GamingTS (GTS) Repository

This repository hosts the GamingTS (GTS) toolchain, a domain-specific language ecosystem for Genshin Impact TCG. It is a monorepo managed with **Bun**.

## 1. Environment & Build

- **Package Manager:** `bun` (do NOT use npm/yarn/pnpm).
- **Workspaces:** Defined in `package.json`. Packages are in `packages/*`.
- **Setup:**
  ```bash
  bun install
  ```
- **Build:**
  - **Note:** There is no root build script. You must build individual packages.
  - Navigate to package: `cd packages/<name>` (or use `workdir` param).
  - Command: `bun run build`
  - Typical build uses `bun build` targeting node/esm.

## 2. Testing

> N.B. Testing are poorly written now and the author recommends to write more tests or adjust existing tests.

- **Test Runner:** `bun test` (native Bun test runner).
- **Location:** Tests are typically located in `packages/<pkg>/__tests__/` and end with `.test.ts`.
- **Running Tests:**
  - Run all tests from root: `bun test`
  - Run tests for a specific package: `bun test` (inside package dir).
  - Run a single test file:
    ```bash
    bun test packages/transpiler/__tests__/transpile.test.ts
    ```
  - Run a specific test case (by name):
    ```bash
    bun test -t "basic transpile pipeline"
    ```

## 3. Code Style & Conventions

### General
- **Language:** TypeScript (strict mode, v5.9+).
- **Runtime:** Bun.
- **Formatting:**
  - Indentation: **2 spaces**.
  - Semicolons: **Yes**.
  - Quotes: Double quotes (`"`) preferred.
  - Follow `.editorconfig` settings.

### Imports & Dependencies
- **Syntax:** Use ESM (`import` / `export`).
- **Workspace Dependencies:** Use the `workspace:*` protocol for internal deps (e.g., `"@gi-tcg/gts-esbuild-plugin": "workspace:*"`).
- **Test Imports:** Always use `import { test, expect } from "bun:test";`.
- **Node Polyfills:** Prefer Bun native APIs, but use node compat if targeting VS Code extension (commonjs/node).

### Naming
- **Packages:** `@gi-tcg/gts-<name>` (e.g., `@gi-tcg/gts-transpiler`).
- **Files:** snake_case or kebab-case preferred for utilities (e.g., `loose_plugin.test.ts`).
- **Classes/Types:** PascalCase.
- **Variables/Functions:** camelCase.

### Error Handling
- Use domain-specific errors where possible (e.g., `GtsTranspilerError`).
- When parsing/transforming, ensure source maps are preserved or generated.

## 4. Architecture Overview

- **packages/transpiler:** Core logic.
  - Pipeline: `parse(source)` -> AST -> `transform(ast)` -> `{ code, sourceMap }`.
  - Tests rely on snapshot-like string comparisons or execution of generated code.
- **packages/vscode:** VS Code Extension.
  - Uses `vsce` for packaging.
  - Language ID: `gaming-ts` (`.gts`).
  - Grammar: `syntaxes/GamingTS.tmLanguage.json`.
- **packages/language-server:** LSP implementation (likely using Volar framework).

## 5. Workflow Rules for Agents

- **Filesystem:** Always use **absolute paths** when using tools like `read` or `write`.
- ~~**Verification:** After editing code, ALWAYS run related tests:~~
  ```bash
  bun test packages/relevant-package/__tests__/related.test.ts
  ```
- **Dependencies:** Do not add external dependencies unless absolutely necessary; prefer `bun` built-ins.
- **Context:** When working on `transpiler`, checking `src/index.ts` is a good start to understand the public API.
