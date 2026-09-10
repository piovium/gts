/// <reference lib="webworker" />
import {
  createConnection,
  createServer,
  createTypeScriptProject,
  loadTsdkByUrl,
  type InitializeParams,
} from "@volar/language-server/browser.js";
import { createGtsLanguagePlugin } from "@gi-tcg/gts-language-plugin";
import path from "path-browserify-esm";
import { type GtsConfig } from "@gi-tcg/gts-transpiler";
import { fs as memfs } from "@zenfs/core";
import type ts from "typescript";
import zenFsProvider from "./zen_fs_provider.ts";
import { createLanguageServicePlugins } from "./services/index.ts";
import { PROJECT_FILE_WATCH_PATTERNS } from "./file_watcher.ts";
import { loadTypeScriptLibs } from "./browser_libs.ts";

export interface GtsLanguageServerBrowserInitializationOptions {
  tsdkUrl?: string;
  inlineGtsConfig?: GtsConfig;
  inlineCompilerOptions?: ts.CompilerOptions;
  fs?: Record<string, string>;
}

const connection = createConnection();
const server = createServer(connection);
let projectFileWatcher: { dispose(): void } | undefined;

server.fileSystem.install("file", zenFsProvider(memfs));

connection.listen();

connection.onInitialize(
  async (
    params: Omit<InitializeParams, "initializationOptions"> & {
      initializationOptions?: GtsLanguageServerBrowserInitializationOptions;
    },
  ) => {
    const {
      tsdkUrl = "https://cdn.jsdelivr.net/npm/typescript@6.0.3/lib",
      fs = {},
      inlineGtsConfig = {},
      inlineCompilerOptions = {},
    } = params.initializationOptions ?? {};
    const tsdk = await loadTsdkByUrl(tsdkUrl, params.locale);
    memfs.mkdirSync("/node_modules/typescript/lib", { recursive: true });
    await loadTypeScriptLibs(tsdk.typescript, tsdkUrl, (name, content) => {
      memfs.writeFileSync(`/node_modules/typescript/lib/${name}`, content);
    });
    for (const [filepath, content] of Object.entries(fs)) {
      memfs.mkdirSync(path.dirname(filepath), { recursive: true });
      memfs.writeFileSync(filepath, content);
    }
    return server.initialize(
      params,
      createTypeScriptProject(tsdk.typescript, tsdk.diagnosticMessages, () => {
        return {
          languagePlugins: [
            createGtsLanguagePlugin(tsdk.typescript, inlineGtsConfig),
          ],
        };
      }),
      createLanguageServicePlugins(tsdk.typescript),
    );
  },
);

connection.onInitialized(async () => {
  server.initialized();
  projectFileWatcher = await server.fileWatcher.watchFiles(
    PROJECT_FILE_WATCH_PATTERNS,
  );
});

connection.onShutdown(() => {
  projectFileWatcher?.dispose();
  server.shutdown();
});

self.addEventListener("error", (event) => {
  console.error("Uncaught exception:", event.error);
});

self.addEventListener("unhandledrejection", (event) => {
  console.error(
    "Unhandled rejection at:",
    event.promise,
    "reason:",
    event.reason,
  );
});
