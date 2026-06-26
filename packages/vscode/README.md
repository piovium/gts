# GamingTS Language Features

VS Code language support for [GamingTS](https://gts.piovium.org) — a TypeScript-based DSL for defining Genius Invokation TCG cards.

## Features

- **Syntax Highlighting** — Full grammars for `.gts` files, including semantic token highlighting for GTS-specific attributes.
- **Language Server** — Powered by Volar, providing:
  - Diagnostics and error reporting
  - Code completion (intellisense)
  - Hover information
  - Go to definition
  - Find references
  - Auto-insertion of closing braces and tags
- **TypeScript Integration** — Seamless integration with the TypeScript language service for type-aware features.
- **Document Decorations** — Visual decorations for Genius Invokation TCG constructs (element types etc.).

## Commands

| Command | Description |
|---------|-------------|
| `GamingTS: Restart Language Server` | Restarts both the TypeScript server and the GTS language server. |

## Extension Settings

GTS configuration is read from the `gamingTs` field in your project's `package.json`. See the [GamingTS documentation](https://gts.piovium.org) for available options.
