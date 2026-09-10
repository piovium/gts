# Desktop integration test

`extension.cjs` drives the real GamingTS extension inside a real Electron
extension host. It is the evidence source for desktop acceptance, but a report it
writes is not itself a receipt: it is the run's own summary, and the acceptance
tooling re-derives every claim from the recorded raw responses.

## Running the test

Build the workspace first, then start VS Code with `extension.cjs` as
`--extensionTestsPath` and `packages/vscode` as `--extensionDevelopmentPath`:

```bash
pnpm build
code \
  --user-data-dir <throwaway profile> \
  --extensions-dir <throwaway extensions> \
  --extensionDevelopmentPath packages/vscode \
  --extensionTestsPath packages/vscode/__tests__/extension.cjs
```

Use a separate profile and extension directory per run, so that the window only
contains the extension under test.

Set `GTS_VSCODE_CYCLES=100` for acceptance. The default of three rounds is only
for developing the test. `GTS_VSCODE_REPORT` names the JSON output file; each
round records document versions, source URIs, timestamps and the diagnostics and
language features VS Code actually returned. A failure throws and retains the
records collected so far.

## Which language services answer

GTS diagnostics are requested directly from the extension's own Volar language
client, `extensionApi.volarLabs.languageClients[0]` of the activated extension.
GTS hovers, definitions, completions and signature help go through the
`vscode.execute*Provider` commands, which dispatch to that same client. TS and
TSX queries go through VS Code's built-in TypeScript extension instead, using
the `typescript.tsserverRequest` command and the same provider commands. Both
routes keep their completed raw responses, and the visible editor diagnostics
must independently reach the expected state.

## Target workspace

Without `GTS_VSCODE_TARGET`, the four documents are resolved next to the
workspace folder root and the workspace is expected to hold the fixture texts of
`packages/language-server/__tests__/fixture.ts` (`current.gts`,
`old_versions.gts`, `consumer.ts`, `component.tsx`), with `healthStatement`
defaulting to `health 10`. On `current.gts` the test verifies that the text ends
with a newline and contains `as Barbara` and `shared: number = 1201`; the other
three documents have to be valid GTS, TS and TSX consumers for the cross-file
assertions to hold.

A collector that needs different anchors sets `GTS_VSCODE_TARGET` to a JSON file:

```json
{
  "workspacePath": "absolute path of the window's single workspace folder",
  "healthStatement": "health 12",
  "files": {
    "current.gts": "absolute path of the real card",
    "old_versions.gts": "absolute path of the collector's dependency probe",
    "consumer.ts": "absolute path of the collector's TS consumer",
    "component.tsx": "absolute path of the collector's TSX consumer"
  }
}
```

`workspacePath` is asserted against the folder VS Code actually opened, so a
mismatch fails instead of silently testing another checkout. The `files` entries
may live outside the workspace folder; their contents have to satisfy the
assertions below.

The collector owns both the probes and their restoration. The card must end with
a newline and temporarily include `export const shared: number = 1201;`, and the
project it belongs to must keep its complete corpus and compiler options. The
test performs unsaved edits, external same-file and dependency edits that it
restores in `finally` blocks, and saves already repaired documents during the
close/reopen scenario.

## What each round covers

Every round checks and repairs a GTS edit, a TS edit, a TSX edit and a GTS
dependency change affecting both consumers, and each valid or repaired phase
requests hover, definition, completion and signature help against the same valid
source. The session also covers syntax errors, missing imports, external disk
updates and actual document close/reopen notifications. Typed hovers reject
`any`, loading placeholders and generated identifiers, and every response is
bound to the document version that was requested.

A completed VS Code save can briefly retain its file handle on Windows; those
retries are recorded and stay within the existing timeout.

## Native evidence and memory sampling

Set `TNB_TRACE_RPC=1` and `TNB_TRACE_RPC_FILE` to retain the native RPC trace of
the GTS server process. `GTS_VSCODE_MEMORY_PRELOAD` names a Node preload sampler;
the test then makes each language service it starts (`tsserver.js`, `server.js`)
load that sampler. Where the sampler writes is up to the sampler itself.

The coordinator must still collect the editor's complete process tree and bind
all logs to the tested source, SDK and native addon.

## Packaging is separate

`pnpm --filter gamingts-vscode run pack` builds a VSIX for ordinary VS Code (see
the `pack` script in `packages/vscode/package.json`). This test does not install
or start that artifact: it measures a development-path extension, and installing
the packaged VSIX is a separate acceptance scenario driven from outside this
directory.
