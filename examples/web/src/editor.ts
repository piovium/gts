import "@codingame/monaco-vscode-theme-defaults-default-extension";
import getKeybindingsServiceOverride from "@codingame/monaco-vscode-keybindings-service-override";
import {
  EditorApp,
  type EditorAppConfig,
} from "monaco-languageclient/editorApp";
import {
  LanguageClientWrapper,
  type LanguageClientConfig,
} from "monaco-languageclient/lcwrapper";
import {
  MonacoVscodeApiWrapper,
  type MonacoVscodeApiConfig,
} from "monaco-languageclient/vscodeApiWrapper";
import { configureDefaultWorkerFactory } from "monaco-languageclient/workerFactory";
import * as vscode from "vscode";
import {
  BrowserMessageReader,
  BrowserMessageWriter,
} from "vscode-languageclient/browser.js";
import EXAMPLE_CODE from "../../local/test.gts?raw";
import GTS_LANGUAGE_CONFIG from "gts-vscode/language-configuration?raw";
import GTS_SYNTAXES from "gts-vscode/syntaxes?raw";
import PROVIDER_VM from "@example/provider/types/vm?raw";
import PROVIDER_QUERY from "@example/provider/types/query?raw";
import GTS_RUNTIME from "@example/provider/types/runtime?raw";
import type { GtsLanguageServerBrowserInitializationOptions } from "@gi-tcg/gts-language-server/browser";

const GTS_LANGUAGE_ID = "gaming-ts";
const WORKSPACE_URI = vscode.Uri.file("/workspace");
const EXAMPLE_FILE_URI = vscode.Uri.file("/workspace/example.gts");

const loadGtsLanguageServerWorker = () => {
  const worker = new Worker(new URL("./server.worker.ts", import.meta.url), {
    type: "module",
    name: "GTS Language Server",
  });
  worker.onmessage = (event) => {
    console.log("Received message from worker: " + event.data);
  };
  return worker;
};

const setupVscodeApiConfig = (): MonacoVscodeApiConfig => {
  // const fileSystemProvider = new RegisteredFileSystemProvider(false);
  //   fileSystemProvider.registerFile(new RegisteredMemoryFile(EXAMPLE_FILE_URI, EXAMPLE_CODE));
  //   registerFileSystemOverlay(1, fileSystemProvider);
  const extensionFilesOrContents = new Map<string, string | URL>();
  extensionFilesOrContents.set(
    "/workspace/language-configuration.json",
    GTS_LANGUAGE_CONFIG,
  );
  extensionFilesOrContents.set(
    "/workspace/GamingTS.tmLanguage.json",
    GTS_SYNTAXES,
  );

  return {
    $type: "extended",
    viewsConfig: {
      $type: "EditorService",
    },
    logLevel: vscode.LogLevel.Debug,
    serviceOverrides: {
      ...getKeybindingsServiceOverride(),
    },
    userConfiguration: {
      json: JSON.stringify({
        "workbench.colorTheme": "Default Dark Modern",
        "editor.guides.bracketPairsHorizontal": "active",
        "editor.wordBasedSuggestions": "off",
        "editor.experimental.asyncTokenization": true,
      }),
    },
    monacoWorkerFactory: configureDefaultWorkerFactory,
    extensions: [
      {
        config: {
          name: "gts-extension",
          publisher: "Piovium Labs",
          version: "0.0.0",
          engines: {
            vscode: "*",
          },
          contributes: {
            languages: [
              {
                id: GTS_LANGUAGE_ID,
                extensions: [".gts"],
                aliases: ["GamingTS", "gaming-ts", "gts"],
                configuration: "/workspace/language-configuration.json",
              },
            ],
            grammars: [
              {
                language: GTS_LANGUAGE_ID,
                scopeName: "source.gts",
                path: "/workspace/GamingTS.tmLanguage.json",
              },
            ],
          },
        },
        filesOrContents: extensionFilesOrContents,
      },
    ],
  };
};

const setupLanguageClientConfig = (): LanguageClientConfig => {
  const worker = loadGtsLanguageServerWorker();
  const reader = new BrowserMessageReader(worker);
  const writer = new BrowserMessageWriter(worker);
  console.log({ PROVIDER_VM });
  return {
    languageId: GTS_LANGUAGE_ID,
    logLevel: vscode.LogLevel.Debug,
    connection: {
      options: {
        $type: "WorkerDirect",
        worker,
      },
      messageTransports: { reader, writer },
    },
    clientOptions: {
      documentSelector: [{ language: GTS_LANGUAGE_ID }],
      workspaceFolder: {
        index: 0,
        name: "workspace",
        uri: WORKSPACE_URI,
      },
      initializationOptions: {
        fs: {
          "/provider/vm.d.ts": PROVIDER_VM,
          "/provider/query.d.ts": PROVIDER_QUERY,
          "/provider/runtime.d.ts": GTS_RUNTIME,
          "/workspace/test2.gts": "export const A = 1",
          "/tsconfig.json": JSON.stringify({
            compilerOptions: {
              lib: ["esnext"],
              types: [],
              target: "esnext",
              module: "preserve",
              verbatimModuleSyntax: true,
              erasableSyntaxOnly: true,
              moduleDetection: "force",
              noEmit: true,
              strict: true,
              skipLibCheck: true,
            },
            include: ["**/*.gts", "**/*.ts"],
          }),
        },
        inlineGtsConfig: {
          providerImportSource: "/provider",
          runtimeImportSource: "/provider/runtime",
        },
      } satisfies GtsLanguageServerBrowserInitializationOptions,
    },
  };
};

export async function setupEditor(container: HTMLElement) {
  const vscodeApiConfig = setupVscodeApiConfig();
  const apiWrapper = new MonacoVscodeApiWrapper(vscodeApiConfig);
  await apiWrapper.start();

  const editorAppConfig: EditorAppConfig = {
    codeResources: {
      modified: {
        text: EXAMPLE_CODE,
        uri: EXAMPLE_FILE_URI.path,
      },
    },
    editorOptions: {
      minimap: {
        enabled: false,
      },
    },
  };

  const languageClientConfig = setupLanguageClientConfig();
  const lcWrapper = new LanguageClientWrapper(languageClientConfig);
  await lcWrapper.start();

  const editorApp = new EditorApp(editorAppConfig);
  await editorApp.start(container);

  await vscode.workspace.openTextDocument(EXAMPLE_FILE_URI);
  await vscode.window.showTextDocument(EXAMPLE_FILE_URI);
}
