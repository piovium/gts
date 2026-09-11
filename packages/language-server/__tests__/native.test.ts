import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { once } from "node:events";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import {
  createProtocolConnection,
  StreamMessageReader,
  StreamMessageWriter,
  type CompletionList,
  type DocumentDiagnosticReport,
  type Hover,
  type InitializeResult,
  type Location,
  type LocationLink,
  type SignatureHelp,
} from "@volar/language-server/node.js";
import { expect, test } from "vitest";
import { URI } from "vscode-uri";
import {
  brokenHealth,
  character,
  createFixture,
  fixtureSources,
  healthStatement,
  repository,
  tsdk,
  typescriptPackageJson,
} from "./fixture.ts";

test("native Node LSP maps GTS semantics and refreshes diagnostics after unsaved edits", async () => {
  const fixture = createFixture();
  const rpcTrace = path.join(fixture.directory, "tnb-rpc-trace.log");
  const child = spawn(
    process.execPath,
    [
      path.join(
        repository,
        "packages/language-server/bin/gts-language-server.js",
      ),
      "--stdio",
    ],
    {
      cwd: fixture.directory,
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
      env: {
        ...process.env,
        TSGO_PROFILE: "1",
        TNB_TRACE_RPC: "1",
        TNB_TRACE_RPC_FILE: rpcTrace,
      },
    },
  );
  let stderr = "";
  child.stderr.setEncoding("utf8").on("data", (text: string) => {
    stderr += text;
  });
  const closed = once(child, "close");
  const connection = createProtocolConnection(
    new StreamMessageReader(child.stdout),
    new StreamMessageWriter(child.stdin),
  );
  child.on("close", () => connection.dispose());
  const logs: string[] = [];
  const request = async <T>(method: string, params?: unknown): Promise<T> => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        connection.sendRequest<T>(method, params),
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () =>
              reject(
                new Error(`${method} timed out\n${stderr}\n${logs.join("\n")}`),
              ),
            30000,
          );
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  };
  connection.onNotification("window/logMessage", (event: { message: string }) =>
    logs.push(event.message),
  );
  connection.onRequest(
    "workspace/configuration",
    (params: { items: unknown[] }) => params.items.map(() => null),
  );
  connection.onRequest("client/registerCapability", () => null);
  connection.onRequest("workspace/diagnostic/refresh", () => null);
  connection.onRequest("workspace/semanticTokens/refresh", () => null);
  connection.listen();
  const uri = fixture.uri("current.gts");
  const diagnostic = async (target = uri) => {
    const report = await request<DocumentDiagnosticReport>(
      "textDocument/diagnostic",
      { textDocument: { uri: target } },
    );
    expect(report.kind).toBe("full");
    return report.kind === "full"
      ? report.items.filter((item) => item.severity === 1)
      : [];
  };
  let version = 1;
  const change = (text: string) =>
    connection.sendNotification("textDocument/didChange", {
      textDocument: { uri, version: ++version },
      contentChanges: [{ text }],
    });
  const targetFile = (definition: Location | LocationLink) =>
    URI.parse("targetUri" in definition ? definition.targetUri : definition.uri)
      .fsPath;
  try {
    const initialized = await request<InitializeResult>("initialize", {
      processId: process.pid,
      rootUri: fixture.uri(),
      workspaceFolders: [{ uri: fixture.uri(), name: "GTS 中文 fixture" }],
      capabilities: {
        workspace: {
          configuration: true,
          workspaceFolders: true,
          didChangeWatchedFiles: { dynamicRegistration: true },
          diagnostics: { refreshSupport: true },
        },
        textDocument: {
          hover: { contentFormat: ["markdown", "plaintext"] },
          completion: { completionItem: { snippetSupport: true } },
          signatureHelp: {
            signatureInformation: {
              documentationFormat: ["markdown", "plaintext"],
            },
          },
          diagnostic: {},
        },
      },
      initializationOptions: { typescript: { tsdk } },
    });
    expect(initialized.capabilities.hoverProvider).toBeTruthy();
    await connection.sendNotification("initialized", {});
    await connection.sendNotification("textDocument/didOpen", {
      textDocument: { uri, languageId: "gaming-ts", version, text: character },
    });
    expect(await diagnostic()).toEqual([]);
    const hover = await request<Hover | null>("textDocument/hover", {
      textDocument: { uri },
      position: { line: 2, character: 15 },
    });
    expect(JSON.stringify(hover)).toContain("CharacterHandle<never>");
    const legacyUri = fixture.uri("old_versions.gts");
    const legacyText = fixtureSources["old_versions.gts"];
    await connection.sendNotification("textDocument/didOpen", {
      textDocument: {
        uri: legacyUri,
        languageId: "gaming-ts",
        version: 1,
        text: legacyText,
      },
    });
    const definitions = await request<(Location | LocationLink)[] | null>(
      "textDocument/definition",
      {
        textDocument: { uri: legacyUri },
        position: { line: 1, character: 31 },
      },
    );
    expect(
      definitions?.map((definition) => ({
        file: targetFile(definition),
        range:
          "targetSelectionRange" in definition
            ? definition.targetSelectionRange
            : definition.range,
      })),
    ).toContainEqual({
      file: URI.parse(uri).fsPath,
      range: {
        start: { line: 2, character: 13 },
        end: { line: 2, character: 20 },
      },
    });
    for (let cycle = 0; cycle < 3; cycle++) {
      await change(brokenHealth(character));
      expect(await diagnostic()).toEqual([
        expect.objectContaining({
          code: 2345,
          range: {
            start: { line: 5, character: 9 },
            end: { line: 5, character: 14 },
          },
        }),
      ]);
      await change(character);
      expect(await diagnostic()).toEqual([]);
    }
    await connection.sendNotification("textDocument/didChange", {
      textDocument: { uri: legacyUri, version: 2 },
      contentChanges: [
        { text: legacyText.replace("legacy: number", "legacy: string") },
      ],
    });
    expect(await diagnostic(legacyUri)).toEqual([
      expect.objectContaining({
        code: 2322,
        range: {
          start: { line: 1, character: 13 },
          end: { line: 1, character: 19 },
        },
      }),
    ]);
    await connection.sendNotification("textDocument/didChange", {
      textDocument: { uri: legacyUri, version: 3 },
      contentChanges: [{ text: legacyText }],
    });
    expect(await diagnostic(legacyUri)).toEqual([]);
    await change(character.replace(healthStatement, "hea"));
    const completion = await request<CompletionList>(
      "textDocument/completion",
      { textDocument: { uri }, position: { line: 5, character: 5 } },
    );
    expect(completion.items.some((item) => item.label === "health")).toBe(true);
    await change(character);
    expect(await diagnostic()).toEqual([]);
    const consumerUri = fixture.uri("consumer.ts");
    await connection.sendNotification("textDocument/didOpen", {
      textDocument: {
        uri: consumerUri,
        languageId: "typescript",
        version: 1,
        text: fixtureSources["consumer.ts"],
      },
    });
    const signature = await request<SignatureHelp | null>(
      "textDocument/signatureHelp",
      {
        textDocument: { uri: consumerUri },
        position: { line: 4, character: 12 },
      },
    );
    expect(signature?.signatures.map((item) => item.label)).toEqual([
      "max(...values: number[]): number",
    ]);
    const sharedDefinition = await request<(Location | LocationLink)[] | null>(
      "textDocument/definition",
      {
        textDocument: { uri: consumerUri },
        position: { line: 3, character: 36 },
      },
    );
    expect(sharedDefinition?.map(targetFile)).toEqual([URI.parse(uri).fsPath]);
    await request("shutdown");
    await connection.sendNotification("exit");
    const [exitCode] = await closed;
    expect(exitCode).toBe(0);
    expect(stderr).toContain("[tsgo-profile]");
    const typescriptPackage = JSON.parse(
      readFileSync(typescriptPackageJson, "utf8"),
    ) as { name: string; version: string };
    expect(typescriptPackage.name).toBe("typescript-native-bridge");
    expect(typescriptPackage.version).toMatch(
      /^\d+\.\d+\.\d+-bridge\.\d+\.tsgo\.\d+/,
    );
    const profile = /^\[tsgo-profile\](.*)$/m.exec(stderr)?.[1] ?? "";
    expect(profile).toContain("getSemanticDiagnostics");
    expect(Number(/rpc=(\d+)\//.exec(profile)?.[1] ?? 0)).toBeGreaterThan(20);
    const trace = readFileSync(rpcTrace, "utf8").trim().split(/\r?\n/);
    const serverPid = `pid=${child.pid}`;
    const bridgeLoads = trace.filter((line) => line.includes("BRIDGE_LOAD"));
    expect(bridgeLoads).toHaveLength(1);
    const bridge = bridgeLoads[0] ?? "";
    expect(bridge).toContain(serverPid);
    expect(bridge).toContain("lib=");
    // The addon the server process really loaded must come from the same
    // node_modules tree as the SDK whose name and version are asserted above.
    const addonPath = bridge.slice(bridge.indexOf("lib=") + 4).trim();
    const installedModules = path.resolve(path.dirname(addonPath), "../../..");
    expect(path.dirname(typescriptPackageJson)).toBe(
      path.join(installedModules, "typescript"),
    );
    const sdkRequire = createRequire(typescriptPackageJson);
    const expectedAddon = path.join(
      path.dirname(
        sdkRequire.resolve(
          `@typescript-native-bridge/${process.platform}-${process.arch}/package.json`,
        ),
      ),
      "native",
      "bridge.node",
    );
    const sha256 = (file: string) =>
      createHash("sha256").update(readFileSync(file)).digest("hex");
    expect(sha256(addonPath)).toBe(sha256(expectedAddon));
    // BRIDGE_LOAD echoes the GODEBUG value this module sets just before loading
    // the addon; it does not prove the Go runtime disabled preemption, and
    // whether the Go side observes asyncpreemptoff=1 is not established by this
    // test.
    const enteredIds = trace
      .filter((line) => line.includes(" ENTER ") && line.includes(serverPid))
      .map((line) => / ENTER (\d+) /.exec(line)?.[1] ?? "");
    expect(
      trace.filter(
        (line) => line.includes(" ENTER ") && !line.includes(serverPid),
      ).length,
      `ENTER lines written by a process other than ${serverPid}`,
    ).toBe(0);
    expect(enteredIds.length, `ENTER count for ${serverPid}`).toBeGreaterThan(
      20,
    );
    expect(new Set(enteredIds).size, "request ids must be unique").toBe(
      enteredIds.length,
    );
    // EXIT lines carry no pid, so pair them with the ENTER of the same request
    // id and drop the requests another process owns.
    const exitedIds = trace
      .filter((line) => line.includes(" EXIT "))
      .map((line) => / EXIT (\d+) /.exec(line)?.[1] ?? "");
    expect(
      exitedIds.filter((id) => enteredIds.includes(id)).length,
      `EXIT count for ${serverPid}`,
    ).toBe(enteredIds.length);
    for (const method of [
      "getSemanticDiagnostics",
      "quickinfo",
      "definitionAndBoundSpan",
      "getCompletionsAtPosition",
      "signatureHelp",
    ]) {
      expect(
        trace.some(
          (line) =>
            line.includes(" ENTER ") &&
            line.includes(serverPid) &&
            line.endsWith(` ${method}`),
        ),
        method,
      ).toBe(true);
    }
    expect([stderr, ...logs].join("\n")).not.toMatch(
      /panic:|Uncaught|Unhandled rejection|heap out of memory/,
    );
  } finally {
    connection.dispose();
    if (child.exitCode === null) child.kill();
    await closed;
    fixture.dispose();
  }
}, 120000);
