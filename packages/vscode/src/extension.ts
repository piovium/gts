import { registerDecorations } from "@gi-tcg/gts-language-client-code/decoration";
import * as serverProtocol from "@volar/language-server/protocol.js";
import {
  activateAutoInsertion,
  CloseAction,
  createLabsInfo,
  ErrorAction,
} from "@volar/vscode";
import {
  BaseLanguageClient,
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
} from "@volar/vscode/node";
import * as vscode from "vscode";
import { configurePrettier } from "./formatter";
import { resolveNativeTsdk } from "./native_tsdk";
import { redirectTsserver } from "./native_tsserver";

let client: BaseLanguageClient;

export async function activate(context: vscode.ExtensionContext) {
  const nativeTsdk = resolveNativeTsdk(
    vscode.workspace.workspaceFolders?.map((folder) => folder.uri.fsPath) ?? [],
    vscode.workspace.getConfiguration("typescript").get<string>("tsdk"),
  );
  // Redirect this window's tsserver entry points. Then restart a server the
  // built-in TypeScript extension may already have started; its restart command
  // is registered only while that extension is active.
  context.subscriptions.push(redirectTsserver(nativeTsdk));
  console.log(`[GamingTS] Using native TypeScript SDK: ${nativeTsdk}`);
  const tsExtension = vscode.extensions.getExtension(
    "vscode.typescript-language-features",
  );
  if (tsExtension?.isActive) {
    await vscode.commands.executeCommand("typescript.restartTsServer");
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
        tsdk: nativeTsdk,
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
  await configurePrettier();

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
