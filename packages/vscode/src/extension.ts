import * as serverProtocol from "@volar/language-server/protocol.js";
import {
  activateAutoInsertion,
  CloseAction,
  createLabsInfo,
  ErrorAction,
  getTsdk,
} from "@volar/vscode";
import {
  BaseLanguageClient,
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
} from "@volar/vscode/node";
import * as vscode from "vscode";
import { patchTypeScriptExtension } from "./patch";
import { registerDecorations } from "@gi-tcg/gts-language-client-code/decoration";

let client: BaseLanguageClient;

const shouldRestart = !patchTypeScriptExtension();

export async function activate(context: vscode.ExtensionContext) {
  if (shouldRestart) {
    // Check if we've already prompted for reload in this session
    const hasPromptedReload = context.globalState.get(
      "GamingTS.hasPromptedReload",
      false,
    );
    if (!hasPromptedReload) {
      // Mark that we've prompted to avoid repeated prompts
      await context.globalState.update("GamingTS.hasPromptedReload", true);
      // Prompt user to restart extension host for full TypeScript integration
      vscode.window
        .showInformationMessage(
          "GamingTS extension needs to restart extensions to enable full TypeScript integration.",
          "Restart Extensions",
          "Later",
        )
        .then((selection) => {
          if (selection === "Restart Extensions") {
            vscode.commands.executeCommand(
              "workbench.action.restartExtensionHost",
            );
          }
        });
    }
  }

  const serverModule = vscode.Uri.joinPath(
    context.extensionUri,
    "dist",
    "server.js",
  );
  const runOptions = { execArgv: <string[]>[] };
  const debugOptions = { execArgv: ["--nolazy", "--inspect=" + 6009] };
  const serverOptions: ServerOptions = {
    run: {
      module: serverModule.fsPath,
      transport: TransportKind.ipc,
      options: runOptions,
    },
    debug: {
      module: serverModule.fsPath,
      transport: TransportKind.ipc,
      options: debugOptions,
    },
  };
  const clientOptions: LanguageClientOptions = {
    documentSelector: [{ language: "gaming-ts" }],
    initializationOptions: {
      typescript: {
        tsdk: (await getTsdk(context))!.tsdk,
      },
    },
    errorHandler: {
      error: (error, message, count) => {
        console.error("Language server error:", error, message, count);
        return { action: ErrorAction.Continue };
      },
      closed: () => {
        console.warn("Language server connection closed");
        return { action: CloseAction.Restart };
      },
    },
  };
  client = new LanguageClient(
    "gts-language-server",
    "GamingTS Language Server",
    serverOptions,
    clientOptions,
  );
  await client.start();

  activateAutoInsertion("gaming-ts", client);

  context.subscriptions.push(
    vscode.commands.registerCommand("gaming-ts.restart-server", async () => {
      await vscode.commands.executeCommand("typescript.restartTsServer");
      await client.stop();
      client.outputChannel.clear();
      await client.start();
      vscode.window.showInformationMessage(
        "GamingTS language server restarted.",
      );
    }),
  );

  context.subscriptions.push(...registerDecorations(vscode));

  // support for https://marketplace.visualstudio.com/items?itemName=johnsoncodehk.volarjs-labs
  // ref: https://twitter.com/johnsoncodehk/status/1656126976774791168
  const labsInfo = createLabsInfo(serverProtocol);
  labsInfo.addLanguageClient(client);
  return labsInfo.extensionExports;
}

export function deactivate(): Thenable<any> | undefined {
  return client?.stop();
}
