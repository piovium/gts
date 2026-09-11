# Dependency patches

The workspace installs the published
`typescript-native-bridge@6.0.3-bridge.16.tsgo.7.0.2` as `typescript`, then applies
the committed pnpm patch. Installation therefore needs neither a locally packed
tarball nor a developer-specific path.

The TNB patch is generated from the TNB checkout at commit
`cd339d9f8d01c87b8ee0d28c3525f19967d11765`, whose patched package repacks with
`npm pack --ignore-scripts` to SHA-256
`9b746524304d0d718f6475cfe46874174f62a65f6a540e3bbe60bc4706a6d677`.
It fixes file freshness for a plain compiler host, virtual-text collection, lazy
source-file inspection, deleted-overlay removal, and declaration transform
behavior. It also refreshes diagnostics when external disk changes follow saved
editor overlays, preserves the relative declaration emit paths that declaration
bundlers rely on, and answers module-specifier resolution from the program cache
instead of binding the imported declarations. The platform addon still comes from the pinned
optional platform package.

The Volar patch keeps GTS's existing removal of the 4 MiB module-size guard.

The `tnbGetSourceText` host hook is not a patch. It lives in this repository as
`packages/language-plugin/src/tnb_text_host.ts` and is installed on the compiler
host by `@gi-tcg/gtsc` when Volar creates the project. It answers with the GTS
virtual code as transpiled text and script kind, so no JavaScript AST is built
in between. It also reads through the host on every call, so external edits stay
visible on a plain compiler host that watches no files. Stock TypeScript ignores
the hook.

No dependency patch can deliver it: `patchedDependencies` applies only inside the
install that declares it, so every consumer of the published `@gi-tcg/gtsc` would
have to repeat the patch.

`packages/tsc/__tests__/program.test.ts` covers the hook against the real GTS
virtual code: cross-file changes, file deletion and recreation, and the
invariant that text collection never reaches `CompilerHost.getSourceFile`.

The `rolldown-plugin-dts` patch passes the plugin's already-resolved `tsconfig`
path to `ts.parseJsonConfigFileContent` as `configFileName`. Without that
argument the parsed options carry no `configFilePath`, so a declaration program
is built as a plain non-project program: stock TypeScript emits declarations from
it, but a compiler that routes project programs (the tsgo-backed `typescript`)
silently falls back to its JavaScript path, and the `emitDtsOnly` declarations the
GTS build ships would never be produced by the native emitter.

The Nitro patch preserves an explicitly requested preview port of zero, which lets
the documentation build choose an available ephemeral port. On Windows, preview
defaults to the IPv4 loopback address, because an IPv6 loopback connection can
be denied even when listening on `::1` succeeds; an explicit preview host still
takes precedence.

After changing a patch, update `pnpm-lock.yaml` with `pnpm install
--lockfile-only`, then verify `pnpm install --frozen-lockfile`, `pnpm build` and
`pnpm test`. Desktop extension behavior additionally requires the real VS Code
tests documented in `packages/vscode/__tests__/README.md`.
