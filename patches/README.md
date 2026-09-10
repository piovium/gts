# Dependency patches

The workspace installs the published
`typescript-native-bridge@6.0.3-bridge.16.tsgo.7.0.2` as `typescript`, then applies
the committed pnpm patch. Installation does not require a local tarball or a
developer's absolute path.

The TNB patch is generated from the companion TNB source checkout at
`b25e3117975310b4e330e7745c8c2fe28b462556`. Its packed build has SHA-256
`9774faf4f0797286e868a62e9c333eb46317afbe9d8cbd317fe9c2818e5ff063`.
It fixes plain compiler-host file freshness, direct virtual-text collection,
lazy source-file inspection, removal of deleted overlays, and declaration
transform behavior. It also refreshes diagnostics when external disk changes
follow saved editor overlays and preserves relative declaration emit paths
used by declaration bundlers. The platform addon continues to come from the pinned
optional platform package.

The Volar patch retains GTS's existing removal of the 4 MiB module-size guard
and adds the `tnbGetSourceText` host hook. The hook supplies current virtual text
and script kind without allocating a JavaScript AST. It preserves disk update
semantics for a plain compiler host. Stock TypeScript ignores the additional
hook. `packages/tsc/__tests__/program.test.ts` exercises the real GTS provider,
cross-file changes, deletion and recreation while asserting that native text
collection never invokes `CompilerHost.getSourceFile`.

The Nitro patch preserves an explicitly requested preview port of zero, which
lets the documentation build choose an available ephemeral port. On Windows,
preview defaults to the IPv4 loopback address because local IPv6 connections
can be denied even when listening on `::1` succeeds. An explicit preview host
continues to take precedence.

After changing a patch, update `pnpm-lock.yaml` with `pnpm install
--lockfile-only`, then verify `pnpm install --frozen-lockfile`, `pnpm build` and
`pnpm test`. Desktop extension behavior additionally requires the real VS Code
tests documented in `packages/vscode/__tests__/README.md`.
