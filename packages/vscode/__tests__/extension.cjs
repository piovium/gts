const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const vscode = require("vscode");

// The memory collector hands its sampler to this host in GTS_VSCODE_MEMORY_PRELOAD.
// Every Node language service started below the host must load it, so the spawn
// and fork entry points are wrapped for the lifetime of the test run.
if (process.env.GTS_VSCODE_MEMORY_PRELOAD) {
  const childProcess = require("node:child_process");
  const sampler = process.env.GTS_VSCODE_MEMORY_PRELOAD;
  const isLanguageServiceEntry = (value) =>
    typeof value === "string" &&
    path.isAbsolute(value) &&
    ["tsserver.js", "server.js"].includes(path.basename(value));
  childProcess.spawn = new Proxy(childProcess.spawn, {
    apply(target, receiver, args) {
      if (Array.isArray(args[1]) && args[1].some(isLanguageServiceEntry))
        args[1] = ["--require", sampler, ...args[1]];
      return Reflect.apply(target, receiver, args);
    },
  });
  childProcess.fork = new Proxy(childProcess.fork, {
    apply(target, receiver, args) {
      if (isLanguageServiceEntry(args[0])) {
        const optionsIndex = Array.isArray(args[1]) ? 2 : 1;
        const options = args[optionsIndex] ?? {};
        args[optionsIndex] = {
          ...options,
          execArgv: [
            ...(options.execArgv ?? process.execArgv),
            "--require",
            sampler,
          ],
        };
      }
      return Reflect.apply(target, receiver, args);
    },
  });
}

exports.run = async function () {
  const startedAtMs = Date.now();
  const root = vscode.workspace.workspaceFolders[0].uri;
  // The integrated-repository collector prepares and restores its own probe files.
  const target = process.env.GTS_VSCODE_TARGET
    ? JSON.parse(fs.readFileSync(process.env.GTS_VSCODE_TARGET, "utf8"))
    : {};
  const fileUri = (name) =>
    target.files?.[name]
      ? vscode.Uri.file(target.files[name])
      : vscode.Uri.joinPath(root, name);
  const healthStatement = target.healthStatement ?? "health 10";
  const records = [];
  const record = (value) => records.push({ at: Date.now(), ...value });
  const sha256 = (value) =>
    crypto.createHash("sha256").update(value).digest("hex");
  if (target.workspacePath)
    assert.equal(root.fsPath, vscode.Uri.file(target.workspacePath).fsPath);
  record({
    operation: "workspace",
    uri: root.toString(),
    targetFiles: target.files ?? null,
  });
  const cycles = Number(process.env.GTS_VSCODE_CYCLES ?? 3);
  assert.ok(Number.isInteger(cycles) && cycles > 0);
  // Kept so a timed-out hover wait can report what it last saw.
  let lastHovers;
  const positionJson = (position) => ({
    line: position.line,
    character: position.character,
  });
  const rangeJson = (range) => ({
    start: positionJson(range.start),
    end: positionJson(range.end),
  });
  const serializeHovers = (hovers) =>
    hovers.map((hover) => ({
      contents: hover.contents.map((content) =>
        typeof content === "string" ? content : content.value,
      ),
      range: hover.range && rangeJson(hover.range),
    }));
  const requestHover = async (uri, position) =>
    serializeHovers(
      await vscode.commands.executeCommand(
        "vscode.executeHoverProvider",
        uri,
        position,
      ),
    );
  const labelText = (item) =>
    typeof item.label === "string" ? item.label : item.label.label;
  const definitionUri = (location) => location.targetUri ?? location.uri;
  const isTypedHover = (hovers, type) => {
    const text = JSON.stringify(hovers);
    return text.includes(type) && !/\bany\b|loading\.\.\.|__gts_/.test(text);
  };
  const waitFor = async (label, check) => {
    const deadline = Date.now() + 30000;
    let actual;
    while (Date.now() < deadline) {
      actual = await check();
      if (actual) return actual;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error(
      `${label} timed out; hovers=${JSON.stringify(lastHovers)}; diagnostics=${JSON.stringify(vscode.languages.getDiagnostics())}`,
    );
  };
  const waitForTypedHover = (label, uri, position, type) =>
    waitFor(label, async () => {
      lastHovers = await requestHover(uri, position);
      return isTypedHover(lastHovers, type) && lastHovers;
    });
  const errors = (uri) =>
    vscode.languages
      .getDiagnostics(uri)
      .filter((item) => item.severity === vscode.DiagnosticSeverity.Error);
  const isClean = (uri) => errors(uri).length === 0;
  const writeExternal = async (file, content) =>
    waitFor("external file write", () => {
      try {
        fs.writeFileSync(file, content);
        return true;
      } catch (error) {
        // A completed VS Code save can briefly retain its Windows file handle.
        if (error.code !== "EBUSY" && error.code !== "EPERM") throw error;
        record({ operation: "filesystem retry", file, code: error.code });
        return false;
      }
    });
  const serializeDiagnostic = (item) => ({
    code: item.code,
    source: item.source,
    message: item.message,
    // VS Code severities are 0-based; the records keep LSP's 1-based values.
    severity: item.severity + 1,
    range: rangeJson(item.range),
  });
  const replace = async (document, content) => {
    const edit = new vscode.WorkspaceEdit();
    edit.replace(
      document.uri,
      new vscode.Range(
        document.positionAt(0),
        document.positionAt(document.getText().length),
      ),
      content,
    );
    assert.equal(await vscode.workspace.applyEdit(edit), true);
  };
  // Written for the collector's precondition checks only. It is this test's own
  // summary of the run, never a harness receipt.
  const writeReport = (status, extra = {}) => {
    if (!process.env.GTS_VSCODE_REPORT) return;
    fs.writeFileSync(
      process.env.GTS_VSCODE_REPORT,
      JSON.stringify(
        {
          status,
          runNonce: process.env.HARNESS_NONCE,
          startedAtMs,
          completedAtMs: Date.now(),
          vscode: vscode.version,
          cycles,
          records,
          ...extra,
        },
        null,
        2,
      ),
    );
  };
  try {
    let current = await vscode.workspace.openTextDocument(
      fileUri("current.gts"),
    );
    const source = current.getText();
    // The hover anchor of the GTS fixture and the declaration the cross-file
    // edits rewrite.
    const barbaraAnchor = "as Barbara";
    const sharedAnchor = "shared: number = 1201";
    assert.ok(source.includes(healthStatement));
    assert.ok(source.includes(barbaraAnchor));
    assert.ok(source.includes(sharedAnchor));
    assert.ok(source.endsWith("\n"));
    const healthIndex = source.indexOf(healthStatement);
    const hoverPosition = current.positionAt(source.indexOf(barbaraAnchor) + 5);
    const argumentPosition = current.positionAt(healthIndex + "health ".length);
    const completionPosition = current.positionAt(healthIndex + 3);
    const appendedLine = current.lineCount - 1;
    await vscode.window.showTextDocument(current, { preview: false });
    const extension = vscode.extensions.getExtension(
      "Guyutongxue.gamingts-vscode",
    );
    assert.ok(extension, "GamingTS extension must be loaded");
    const extensionApi = await extension.activate();
    const gtsClient = extensionApi.volarLabs.languageClients[0];
    assert.ok(
      gtsClient,
      "Use the language client of the real GamingTS extension",
    );
    const hovers = await waitForTypedHover(
      "native GTS hover",
      current.uri,
      hoverPosition,
      "CharacterHandle",
    );
    record({ operation: "GTS hover", value: hovers });
    let consumer = await vscode.workspace.openTextDocument(
      fileUri("consumer.ts"),
    );
    const consumerSource = consumer.getText();
    // Hover anchors on the first line of each consumer fixture: the imported
    // `Barbara` in consumer.ts and the imported `shared` in component.tsx.
    const consumerHoverPosition = new vscode.Position(0, 12);
    const componentHoverPosition = new vscode.Position(0, 11);
    await vscode.window.showTextDocument(consumer, { preview: false });
    const tsHovers = await waitForTypedHover(
      "native TS consumer hover",
      consumer.uri,
      consumerHoverPosition,
      "CharacterHandle",
    );
    record({ operation: "TS consumer hover", value: tsHovers });
    let component = await vscode.workspace.openTextDocument(
      fileUri("component.tsx"),
    );
    const componentSource = component.getText();
    await vscode.window.showTextDocument(component, { preview: false });
    const tsxHovers = await waitForTypedHover(
      "native TSX consumer hover",
      component.uri,
      componentHoverPosition,
      "number",
    );
    record({ operation: "TSX consumer hover", value: tsxHovers });
    const fixturesClean = () =>
      isClean(current.uri) && isClean(consumer.uri) && isClean(component.uri);
    await waitFor("positive diagnostics", fixturesClean);
    const signature = await vscode.commands.executeCommand(
      "vscode.executeSignatureHelpProvider",
      current.uri,
      argumentPosition.translate(0, 1),
      " ",
    );
    assert.ok(
      signature?.signatures.some((item) => item.label.includes("number")),
      "GTS signature must expose the VM argument type",
    );
    record({
      operation: "GTS signature",
      version: current.version,
      value: signature,
    });
    await replace(current, source + "export const broken = ;\r\n");
    const syntaxError = await waitFor("GTS syntax error", () =>
      errors(current.uri).find((item) => Number(item.code) === 1109),
    );
    assert.equal(syntaxError.range.start.line, appendedLine);
    record({
      operation: "syntax error",
      version: current.version,
      diagnostic: serializeDiagnostic(syntaxError),
    });
    await replace(current, source);
    await waitFor("syntax repair", fixturesClean);
    await replace(
      current,
      source + 'import { missing } from "./missing-dependency.gts";\r\n',
    );
    const importError = await waitFor("GTS missing import", () =>
      errors(current.uri).find(
        (item) => Number(item.code) === 2882 || Number(item.code) === 2307,
      ),
    );
    assert.equal(importError.range.start.line, appendedLine);
    assert.ok(importError.message.includes("missing-dependency.gts"));
    record({
      operation: "invalid import",
      version: current.version,
      diagnostic: serializeDiagnostic(importError),
    });
    await replace(current, source);
    await waitFor("import repair", () => isClean(current.uri));
    const legacyUri = fileUri("old_versions.gts");
    const legacySource = fs.readFileSync(legacyUri.fsPath, "utf8");
    try {
      await writeExternal(
        legacyUri.fsPath,
        legacySource.replace(
          "legacy: number = Barbara",
          'legacy: string = "changed"',
        ),
      );
      const diskError = await waitFor("external disk change reaches TS", () =>
        errors(consumer.uri).find((item) => Number(item.code) === 2322),
      );
      record({
        operation: "external disk edit",
        version: consumer.version,
        diagnostic: serializeDiagnostic(diskError),
      });
    } finally {
      await writeExternal(legacyUri.fsPath, legacySource);
    }
    await waitFor("external disk repair", () => isClean(consumer.uri));
    record({ operation: "external disk repair", version: consumer.version });
    // Appending a declaration whose initializer contradicts its type gives the
    // fixture its own 2322, independent of the cross-file edits.
    const independentTypeError =
      "\r\nexport const independent: string = 1;\r\n";
    const invalidHealth = source.replace(healthStatement, 'health "bad"');
    let requestId = 0;
    const descriptors = [
      {
        name: "GTS",
        route: "gts-lsp",
        document: () => current,
        validText: source,
        badText: invalidHealth,
        code: 2345,
        hoverType: "CharacterHandle",
      },
      {
        name: "TS",
        route: "tsserver",
        document: () => consumer,
        validText: consumerSource,
        badText: consumerSource + independentTypeError,
        code: 2322,
        hoverType: "CharacterHandle",
      },
      {
        name: "TSX",
        route: "tsserver",
        document: () => component,
        validText: componentSource,
        badText: componentSource + independentTypeError,
        code: 2322,
        hoverType: "number",
      },
    ];
    const feature = async (descriptor, name, position, command) => {
      const document = descriptor.document();
      const version = document.version;
      const id = ++requestId;
      record({
        operation: "feature request",
        name: descriptor.name,
        uri: document.uri.toString(),
        version,
        requestId: id,
        command,
        feature: name,
        position: positionJson(position),
      });
      const result = await vscode.commands.executeCommand(
        command,
        document.uri,
        position,
      );
      assert.equal(
        document.version,
        version,
        "Feature response must belong to the requested document version",
      );
      let response;
      if (name === "hover") {
        const hovers = serializeHovers(result);
        lastHovers = hovers;
        assert.ok(isTypedHover(hovers, descriptor.hoverType));
        response = { contents: hovers.flatMap((hover) => hover.contents) };
      } else if (name === "definition") {
        record({
          operation: "raw definition",
          name: descriptor.name,
          uri: document.uri.toString(),
          version,
          requestId: id,
          value: result,
        });
        response = result.map((item) => ({
          uri: definitionUri(item).toString(),
          range: rangeJson(
            item.targetSelectionRange ?? item.range ?? item.targetRange,
          ),
        }));
        assert.ok(response.some((item) => item.uri === current.uri.toString()));
      } else if (name === "completion") {
        response = {
          items: result.items.map((item) => ({ label: labelText(item) })),
        };
        assert.ok(
          response.items.some(
            (item) =>
              item.label === (descriptor.name === "GTS" ? "health" : "max"),
          ),
        );
        assert.ok(
          !response.items.some((item) => item.label.includes("__gts_")),
        );
      } else {
        response = {
          signatures: result?.signatures.map((item) => ({ label: item.label })),
          activeSignature: result?.activeSignature,
          activeParameter: result?.activeParameter,
        };
        assert.ok(
          response.signatures?.some((item) => item.label.includes("number")),
        );
        assert.ok(
          !response.signatures.some((item) => item.label.includes("__gts_")),
        );
      }
      record({
        operation: "observation",
        name: descriptor.name,
        route: descriptor.route,
        kind: "feature",
        uri: document.uri.toString(),
        version,
        requestId: id,
        feature: name,
        position: positionJson(position),
        response,
      });
    };
    const featureCommands = {
      hover: "vscode.executeHoverProvider",
      definition: "vscode.executeDefinitionProvider",
      completion: "vscode.executeCompletionItemProvider",
      signature: "vscode.executeSignatureHelpProvider",
    };
    // GTS features are queried at the fixture anchors. Both consumer fixtures end
    // with a `Math.max` call, so their feature positions follow that same anchor.
    const featurePositions = (descriptor, document) => {
      if (descriptor.name === "GTS") {
        return {
          hover: hoverPosition,
          definition: hoverPosition,
          completion: completionPosition,
          signature: argumentPosition.translate(0, 1),
        };
      }
      assert.ok(
        descriptor.validText.includes("Math.max("),
        `${descriptor.name} fixture must end with a Math.max call`,
      );
      const after = (text) =>
        document.positionAt(
          descriptor.validText.lastIndexOf(text) + text.length,
        );
      return {
        hover: consumerHoverPosition,
        definition: consumerHoverPosition,
        completion: after("Math.ma"),
        signature: after("Math.max("),
      };
    };
    // `typescript.tsserverRequest` answers in tsserver's own shape, not in the
    // LSP shape the records and the assertions below use.
    const tsserverDiagnostic = (document, item) => {
      const start =
        item.startLocation ??
        (typeof item.start === "object" ? item.start : null);
      const end =
        item.endLocation ?? (typeof item.end === "object" ? item.end : null);
      return {
        code: item.code,
        message: item.text ?? item.message,
        severity: 1,
        range:
          start && end
            ? {
                start: { line: start.line - 1, character: start.offset - 1 },
                end: { line: end.line - 1, character: end.offset - 1 },
              }
            : {
                start: positionJson(document.positionAt(item.start)),
                end: positionJson(
                  document.positionAt(item.start + item.length),
                ),
              },
      };
    };
    const observePhase = async (descriptor, cycle, phase, origin) => {
      const document = descriptor.document();
      const expectedText =
        phase === "bad" ? descriptor.badText : descriptor.validText;
      assert.equal(document.getText(), expectedText);
      const version = document.version;
      record({
        operation: "observation",
        name: descriptor.name,
        route: descriptor.route,
        kind: "source",
        uri: document.uri.toString(),
        version,
        text: document.getText(),
        cycle,
        phase,
        origin,
      });
      let diagnosticRequestId;
      const diagnostics = await waitFor(
        `${descriptor.name} ${cycle}/${phase} diagnostics`,
        async () => {
          const id = ++requestId;
          record({
            operation: "diagnostic request",
            name: descriptor.name,
            route: descriptor.route,
            uri: document.uri.toString(),
            version,
            requestId: id,
          });
          let raw, items;
          if (descriptor.route === "gts-lsp") {
            raw = await gtsClient.sendRequest("textDocument/diagnostic", {
              textDocument: { uri: document.uri.toString() },
            });
            assert.equal(raw.kind, "full");
            items = raw.items.filter((item) => item.severity === 1);
          } else {
            raw = [];
            items = [];
            for (const command of [
              "syntacticDiagnosticsSync",
              "semanticDiagnosticsSync",
            ]) {
              const response = await vscode.commands.executeCommand(
                "typescript.tsserverRequest",
                command,
                { file: document.uri, includeLinePosition: true },
              );
              assert.equal(response?.success, true);
              assert.ok(Array.isArray(response.body));
              raw.push({ command, response });
              items.push(
                ...response.body
                  .filter((item) => item.category === "error")
                  .map((item) => tsserverDiagnostic(document, item)),
              );
            }
          }
          assert.equal(document.version, version);
          record({
            operation: "raw diagnostics",
            name: descriptor.name,
            route: descriptor.route,
            uri: document.uri.toString(),
            version,
            requestId: id,
            value: raw,
          });
          const satisfied =
            phase === "bad"
              ? items.some((item) => Number(item.code) === descriptor.code)
              : items.length === 0;
          if (!satisfied) return false;
          diagnosticRequestId = id;
          return items;
        },
      );
      await waitFor(
        `${descriptor.name} ${cycle}/${phase} displayed diagnostics`,
        () =>
          phase === "bad"
            ? errors(document.uri).some(
                (item) => Number(item.code) === descriptor.code,
              )
            : isClean(document.uri),
      );
      assert.equal(document.version, version);
      record({
        operation: "observation",
        name: descriptor.name,
        route: descriptor.route,
        kind: "diagnostics",
        uri: document.uri.toString(),
        version,
        requestId: diagnosticRequestId,
        response: diagnostics,
      });
      if (phase === "bad") return;
      const positions = featurePositions(descriptor, document);
      for (const [name, command] of Object.entries(featureCommands))
        await feature(descriptor, name, positions[name], command);
    };
    for (const descriptor of descriptors) {
      record({
        operation: "fixture",
        name: descriptor.name,
        route: descriptor.route,
        uri: descriptor.document().uri.toString(),
        validText: descriptor.validText,
        badText: descriptor.badText,
      });
      await observePhase(descriptor, "initial", "valid", "open");
      await replace(descriptor.document(), descriptor.badText);
      await observePhase(descriptor, "initial", "bad", "editor");
      await replace(descriptor.document(), descriptor.validText);
      await observePhase(descriptor, "initial", "restored", "editor");
      const document = descriptor.document();
      await document.save();
      const originalBytes = fs.readFileSync(document.uri.fsPath);
      try {
        await writeExternal(document.uri.fsPath, descriptor.badText);
        record({
          operation: "filesystem write",
          name: descriptor.name,
          uri: document.uri.toString(),
          phase: "bad",
          sha256: sha256(fs.readFileSync(document.uri.fsPath)),
        });
        await waitFor(
          `${descriptor.name} external source reload`,
          () => document.getText() === descriptor.badText,
        );
        await observePhase(descriptor, "external", "bad", "filesystem");
      } finally {
        await writeExternal(document.uri.fsPath, originalBytes);
        record({
          operation: "filesystem write",
          name: descriptor.name,
          uri: document.uri.toString(),
          phase: "restored",
          sha256: sha256(fs.readFileSync(document.uri.fsPath)),
        });
      }
      await waitFor(
        `${descriptor.name} external source repair`,
        () => document.getText() === descriptor.validText,
      );
      await observePhase(descriptor, "external", "restored", "filesystem");
    }
    for (let cycle = 0; cycle < cycles; cycle++) {
      // Language changes close a model and can replace its TextDocument object.
      // Resolve the live models by URI before reading versions or applying edits.
      current = await vscode.workspace.openTextDocument(fileUri("current.gts"));
      consumer = await vscode.workspace.openTextDocument(
        fileUri("consumer.ts"),
      );
      component = await vscode.workspace.openTextDocument(
        fileUri("component.tsx"),
      );
      await replace(current, invalidHealth);
      const invalid = await waitFor("GTS argument error", () =>
        errors(current.uri).find((item) => Number(item.code) === 2345),
      );
      assert.deepEqual(
        rangeJson(invalid.range),
        rangeJson({
          start: argumentPosition,
          end: argumentPosition.translate(0, 5),
        }),
      );
      record({
        operation: "GTS invalid",
        cycle,
        uri: current.uri.toString(),
        version: current.version,
        diagnostic: serializeDiagnostic(invalid),
      });
      await observePhase(descriptors[0], cycle + 1, "bad", "editor");
      await replace(current, source);
      await waitFor("GTS repair", () => isClean(current.uri));
      const query = await waitForTypedHover(
        "GTS repaired typed hover",
        current.uri,
        hoverPosition,
        "CharacterHandle",
      );
      record({
        operation: "GTS repair/query",
        cycle,
        uri: current.uri.toString(),
        version: current.version,
        diagnostics: errors(current.uri),
        hover: query,
      });
      await observePhase(descriptors[0], cycle + 1, "restored", "editor");
      {
        await replace(
          current,
          source.replace(sharedAnchor, 'shared: string = "changed"'),
        );
        const crossTs = await waitFor("unsaved GTS change reaches TS", () =>
          errors(consumer.uri).find((item) => Number(item.code) === 2322),
        );
        const crossTsx = await waitFor("unsaved GTS change reaches TSX", () =>
          errors(component.uri).find((item) => Number(item.code) === 2322),
        );
        record({
          operation: "unsaved cross-file invalid",
          cycle,
          uri: current.uri.toString(),
          version: current.version,
          tsVersion: consumer.version,
          tsxVersion: component.version,
          ts: serializeDiagnostic(crossTs),
          tsx: serializeDiagnostic(crossTsx),
        });
        await replace(current, source);
        await waitFor("unsaved cross-file repair", fixturesClean);
        record({
          operation: "unsaved cross-file repair",
          cycle,
          version: current.version,
        });
      }
      for (const descriptor of descriptors.filter(
        (item) => item.name !== "GTS",
      )) {
        const document = descriptor.document();
        await replace(document, descriptor.validText + independentTypeError);
        const invalid = await waitFor(`${descriptor.name} own edit error`, () =>
          errors(document.uri).find((item) => Number(item.code) === 2322),
        );
        const query = await waitForTypedHover(
          `${descriptor.name} own edit typed hover`,
          document.uri,
          consumerHoverPosition,
          descriptor.hoverType,
        );
        record({
          operation: `${descriptor.name} invalid/query`,
          cycle,
          uri: document.uri.toString(),
          version: document.version,
          diagnostic: serializeDiagnostic(invalid),
          hover: query,
        });
        await observePhase(descriptor, cycle + 1, "bad", "editor");
        await replace(document, descriptor.validText);
        await waitFor(`${descriptor.name} own edit repair`, () =>
          isClean(document.uri),
        );
        record({
          operation: `${descriptor.name} repair`,
          cycle,
          uri: document.uri.toString(),
          version: document.version,
        });
        await observePhase(descriptor, cycle + 1, "restored", "editor");
      }
      if (cycle === Math.floor(cycles / 2)) {
        let closed = false;
        const subscription = vscode.workspace.onDidCloseTextDocument(
          (document) => {
            if (document.uri.toString() === current.uri.toString())
              closed = true;
          },
        );
        assert.equal(current.getText(), source);
        await current.save();
        await consumer.save();
        await component.save();
        record({
          operation: "before close",
          cycle,
          version: current.version,
          dirty: current.isDirty,
        });
        await vscode.window.showTextDocument(current, { preview: false });
        await vscode.commands.executeCommand(
          "workbench.action.revertAndCloseActiveEditor",
        );
        await vscode.commands.executeCommand(
          "workbench.action.closeAllEditors",
        );
        // VS Code may keep the model alive after closing its tabs, so change
        // the language mode to force a close before reopening it.
        const plainDocument = await vscode.languages.setTextDocumentLanguage(
          current,
          "plaintext",
        );
        await waitFor("GTS document close", () => closed);
        subscription.dispose();
        current = await vscode.languages.setTextDocumentLanguage(
          plainDocument,
          "gaming-ts",
        );
        await vscode.window.showTextDocument(current, { preview: false });
        consumer = await vscode.workspace.openTextDocument(
          fileUri("consumer.ts"),
        );
        await vscode.window.showTextDocument(consumer, { preview: false });
        component = await vscode.workspace.openTextDocument(
          fileUri("component.tsx"),
        );
        await vscode.window.showTextDocument(component, { preview: false });
        record({
          operation: "close/reopen",
          trigger: "close tabs then change language mode",
          cycle,
          version: current.version,
        });
      }
    }
    await replace(
      consumer,
      consumerSource.replace("value: number", "value: string"),
    );
    const typeError = await waitFor("TS consumer error", () =>
      errors(consumer.uri).find((item) => Number(item.code) === 2322),
    );
    record({
      operation: "TS invalid",
      version: consumer.version,
      diagnostic: serializeDiagnostic(typeError),
    });
    await replace(consumer, consumerSource);
    await waitFor("TS repair", () => isClean(consumer.uri));
    const definitions = await vscode.commands.executeCommand(
      "vscode.executeDefinitionProvider",
      consumer.uri,
      consumerHoverPosition,
    );
    assert.ok(
      definitions.some(
        (item) => definitionUri(item).fsPath === current.uri.fsPath,
      ),
      "TS definition must lead to GTS source",
    );
    record({ operation: "TS definition", value: definitions });
    const tsSignatureSource = consumerSource + "\r\nMath.max(1, 2);\r\n";
    await replace(consumer, tsSignatureSource);
    const tsSignature = await vscode.commands.executeCommand(
      "vscode.executeSignatureHelpProvider",
      consumer.uri,
      consumer.positionAt(
        tsSignatureSource.lastIndexOf("Math.max(") + "Math.max(".length,
      ),
      "(",
    );
    assert.ok(
      tsSignature?.signatures.some((item) => item.label.includes("number")),
      "TS signature must expose the library number type",
    );
    record({
      operation: "TS signature",
      version: consumer.version,
      value: tsSignature,
    });
    const tsCompletionSource = consumerSource + "\r\nMath.ma";
    await replace(consumer, tsCompletionSource);
    const tsCompletion = await vscode.commands.executeCommand(
      "vscode.executeCompletionItemProvider",
      consumer.uri,
      consumer.positionAt(tsCompletionSource.length),
    );
    assert.ok(tsCompletion.items.some((item) => labelText(item) === "max"));
    record({
      operation: "TS completion",
      version: consumer.version,
      items: tsCompletion.items.map((item) => ({
        label: item.label,
        detail: item.detail,
      })),
    });
    await replace(consumer, consumerSource);
    await waitFor("TS feature repair", () => isClean(consumer.uri));
    const legacyDocument = await vscode.workspace.openTextDocument(legacyUri);
    const gtsDefinitions = await vscode.commands.executeCommand(
      "vscode.executeDefinitionProvider",
      legacyUri,
      legacyDocument.positionAt(
        legacyDocument.getText().lastIndexOf("Barbara"),
      ),
    );
    assert.ok(
      gtsDefinitions.some(
        (item) => definitionUri(item).fsPath === current.uri.fsPath,
      ),
      "GTS definition must lead to GTS source",
    );
    record({ operation: "GTS definition", value: gtsDefinitions });
    await replace(current, source.replace(healthStatement, "hea"));
    const completions = await vscode.commands.executeCommand(
      "vscode.executeCompletionItemProvider",
      current.uri,
      completionPosition,
    );
    assert.ok(completions.items.some((item) => labelText(item) === "health"));
    record({
      operation: "GTS completion",
      version: current.version,
      items: completions.items.map((item) => ({
        label: item.label,
        detail: item.detail,
      })),
    });
    await replace(current, source);
    await waitFor("final positive diagnostics", fixturesClean);
    writeReport("PASS");
  } catch (error) {
    writeReport("FAIL", { error: String(error.stack) });
    throw error;
  }
};
