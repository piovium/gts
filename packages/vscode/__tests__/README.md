# Native desktop integration test

Build GamingTS first, then run VS Code with this directory's `extension.cjs` as
`--extensionTestsPath` and `packages/vscode` as `--extensionDevelopmentPath`.
Use a separate user profile and extension directory for each run. The test runs
inside the real Electron extension host.

Set `GTS_VSCODE_CYCLES=100` for acceptance. The default of three rounds is only
for developing the test. `GTS_VSCODE_REPORT` names the JSON output file; each
round records document versions, source URIs, timestamps and actual VS Code
diagnostics/queries. GTS diagnostics use the extension's existing Volar Labs
language client. TS/TSX diagnostics use VS Code's existing
`typescript.tsserverRequest` command. Both retain completed raw responses, and
the visible editor diagnostics must independently reach the expected state.
A failure throws and retains the records collected so far.

The default workspace is the fixture created by
`packages/language-server/__tests__/fixture.ts`. An integration collector can
set `GTS_VSCODE_TARGET` to a JSON file with these fields:

```json
{
  "workspacePath": "absolute path to the opened repository or packages/data",
  "healthStatement": "health 12",
  "files": {
    "current.gts": "absolute path to the real barbara.gts",
    "old_versions.gts": "absolute path to the collector's dependency probe",
    "consumer.ts": "absolute path to the collector's TS consumer",
    "component.tsx": "absolute path to the collector's TSX consumer"
  }
}
```

The collector prepares the probe files from the shared fixture and points their
imports at the real card. The card must end with a newline and temporarily
include `export const shared: number = 1201;`. Its existing project must retain
the complete corpus and compiler options. The collector owns exact restoration
of all changed files. The test performs unsaved edits, external same-file and
dependency edits that it restores in `finally` blocks, and saves already repaired
documents during the close/reopen scenario. A brief Windows file lock after
saving is retried within the existing timeout and every retry is recorded.

Each round checks and repairs GTS, TS and TSX edits and a GTS dependency change
affecting both consumers. The session also checks syntax errors, missing imports,
external disk updates, hover, definition, completion, signature help, and actual
document close/reopen notifications. Every valid/repaired phase requests all
four language features against the same valid source. Typed hovers reject `any`, loading
placeholders and generated identifiers.

Set `TNB_TRACE_RPC=1` and `TNB_TRACE_RPC_FILE` to retain native RPC evidence.
For memory collection, `GTS_VSCODE_MEMORY_PRELOAD` accepts an existing Node
preload sampler and `GTS_MEMORY_DIRECTORY` its output directory. The test loads
that sampler in the real GTS server and TS server child processes. The coordinator
must still collect the editor's complete process tree and bind all logs to the
tested source, SDK and native addon. Test reports alone are not harness receipts.

Build a VSIX for ordinary VS Code with `pnpm --filter gamingts-vscode run pack`
after the workspace's frozen installation. An optional positional argument sets
the output file. The package script builds the extension and its dependencies,
uses pnpm's frozen deployment to retain the exact dependency patches, and checks
the deployed GTS/TNB/Volar modules and native addon against the tested workspace.
It produces a VSIX for the current OS and CPU architecture in `temp/` by default.
Install that artifact through VS Code's “Install from VSIX” command. Packaging
does not publish an extension or change the user's installed VS Code extensions.
