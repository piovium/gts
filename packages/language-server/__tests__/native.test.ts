import { spawn } from "node:child_process";
import { once } from "node:events";
import path from "node:path";
import {
  createProtocolConnection,
  StreamMessageReader,
  StreamMessageWriter,
  type DocumentDiagnosticReport,
  type Hover,
  type Location,
  type LocationLink,
  type CompletionList,
  type InitializeResult,
} from "@volar/language-server/node.js";
import { expect, test } from "vitest";
import { URI } from "vscode-uri";
import { character, createFixture, repository, tsdk } from "./fixture.ts";

test("native Node LSP maps GTS semantics and refreshes diagnostics after unsaved edits", async () => {
  const fixture = createFixture();
  const child = spawn(process.execPath, [path.join(repository, "packages/language-server/bin/gts-language-server.js"), "--stdio"], {
    cwd: fixture.directory,
    windowsHide: true,
    stdio: ["pipe", "pipe", "pipe"],
    env: { ...process.env, TSGO_PROFILE: "1" },
  });
  let stderr = "";
  child.stderr.setEncoding("utf8").on("data", (text: string) => { stderr += text; });
  const closed = once(child, "close");
  const connection = createProtocolConnection(new StreamMessageReader(child.stdout), new StreamMessageWriter(child.stdin));
  child.on("close", () => connection.dispose());
  const logs: string[] = [];
  connection.onNotification("window/logMessage", (event: { message: string }) => logs.push(event.message));
  connection.onRequest("workspace/configuration", (params: { items: unknown[] }) => params.items.map(() => null));
  connection.onRequest("client/registerCapability", () => null);
  connection.onRequest("workspace/diagnostic/refresh", () => null);
  connection.onRequest("workspace/semanticTokens/refresh", () => null);
  connection.listen();
  const uri = fixture.uri("current.gts");
  const diagnostic = async (target = uri) => {
    const report = await connection.sendRequest<DocumentDiagnosticReport>("textDocument/diagnostic", { textDocument: { uri: target } });
    expect(report.kind).toBe("full");
    return report.kind === "full" ? report.items.filter((item) => item.severity === 1) : [];
  };
  let version = 1;
  const change = (text: string) => connection.sendNotification("textDocument/didChange", { textDocument: { uri, version: ++version }, contentChanges: [{ text }] });
  try {
    const initialized = await connection.sendRequest<InitializeResult>("initialize", {
      processId: process.pid,
      rootUri: fixture.uri(),
      workspaceFolders: [{ uri: fixture.uri(), name: "GTS 中文 fixture" }],
      capabilities: {
        workspace: { configuration: true, workspaceFolders: true, didChangeWatchedFiles: { dynamicRegistration: true }, diagnostics: { refreshSupport: true } },
        textDocument: { hover: { contentFormat: ["markdown", "plaintext"] }, completion: { completionItem: { snippetSupport: true } }, diagnostic: {} },
      },
      initializationOptions: { typescript: { tsdk } },
    });
    expect(initialized.capabilities.hoverProvider).toBeTruthy();
    await connection.sendNotification("initialized", {});
    await connection.sendNotification("textDocument/didOpen", { textDocument: { uri, languageId: "gaming-ts", version, text: character } });
    expect(await diagnostic()).toEqual([]);
    const hover = await connection.sendRequest<Hover | null>("textDocument/hover", { textDocument: { uri }, position: { line: 2, character: 15 } });
    expect(JSON.stringify(hover)).toContain("CharacterHandle");
    const legacyUri = fixture.uri("old_versions.gts");
    const legacyText = 'import { Barbara } from "./current.gts";\r\nexport const legacy: number = Barbara;\r\n';
    await connection.sendNotification("textDocument/didOpen", { textDocument: { uri: legacyUri, languageId: "gaming-ts", version: 1, text: legacyText } });
    const definitions = await connection.sendRequest<(Location | LocationLink)[] | null>("textDocument/definition", { textDocument: { uri: legacyUri }, position: { line: 1, character: 31 } });
    expect(definitions?.map((definition) => ({
      file: URI.parse("targetUri" in definition ? definition.targetUri : definition.uri).fsPath,
      range: "targetSelectionRange" in definition ? definition.targetSelectionRange : definition.range,
    }))).toContainEqual({
      file: URI.parse(uri).fsPath,
      range: { start: { line: 2, character: 13 }, end: { line: 2, character: 20 } },
    });
    for (let cycle = 0; cycle < 3; cycle++) {
      await change(character.replace("health 10", 'health "bad"'));
      expect(await diagnostic()).toEqual([expect.objectContaining({ code: 2345, range: { start: { line: 5, character: 9 }, end: { line: 5, character: 14 } } })]);
      await change(character);
      expect(await diagnostic()).toEqual([]);
    }
    await connection.sendNotification("textDocument/didChange", { textDocument: { uri: legacyUri, version: 2 }, contentChanges: [{ text: legacyText.replace("legacy: number", "legacy: string") }] });
    expect(await diagnostic(legacyUri)).toEqual([expect.objectContaining({ code: 2322, range: { start: { line: 1, character: 13 }, end: { line: 1, character: 19 } } })]);
    await connection.sendNotification("textDocument/didChange", { textDocument: { uri: legacyUri, version: 3 }, contentChanges: [{ text: legacyText }] });
    expect(await diagnostic(legacyUri)).toEqual([]);
    await change(character.replace("health 10", "hea"));
    const completion = await connection.sendRequest<CompletionList>("textDocument/completion", { textDocument: { uri }, position: { line: 5, character: 5 } });
    expect(completion.items.some((item) => item.label === "health")).toBe(true);
    await change(character);
    expect(await diagnostic()).toEqual([]);
    await connection.sendRequest("shutdown");
    await connection.sendNotification("exit");
    const [exitCode] = await closed;
    expect(exitCode).toBe(0);
    expect(stderr).toContain("[tsgo-profile]");
    expect([stderr, ...logs].join("\n")).not.toMatch(/panic:|Uncaught|Unhandled rejection|heap out of memory/);
  } finally {
    connection.dispose();
    if (child.exitCode === null) child.kill();
    await closed;
    fixture.dispose();
  }
}, 120000);
