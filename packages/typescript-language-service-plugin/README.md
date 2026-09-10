# GamingTS TypeScript Language Service Plugin

`@gi-tcg/gts-typescript-language-service-plugin` is a _TypeScript_ language service
plugin: it is injected into `tsserver` and teaches it to read GamingTS files as
TypeScript modules, so that a `.ts` or `.tsx` file can resolve and type what it
imports from a `.gts` module. It provides no diagnostics of its own; `.gts`
diagnostics and language features come from the extension's own language server
in this repository.

The GamingTS VS Code extension ships this plugin and declares it under
`typescriptServerPlugins`, which is what makes VS Code load it into the
`tsserver` it starts. That `tsserver` is the native one: the extension redirects
it to the same `typescript-native-bridge` SDK its own language server runs on, so
both language services agree on program semantics. See
`packages/vscode/src/native_tsserver.ts`.

`tsserver` loads plugins as CommonJS and reads only a package's `main` field, so
this package needs a CommonJS entry point and cannot rely on `exports`.
