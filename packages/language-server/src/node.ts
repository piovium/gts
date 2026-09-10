import {
  createConnection,
  createServer,
  createTypeScriptProject,
  Diagnostic,
  Disposable,
  loadTsdkByPath,
} from "@volar/language-server/node.js";
import { createGtsLanguagePlugin } from "@gi-tcg/gts-language-plugin";
import { createLanguageServicePlugins } from "./services/index.ts";
import { PROJECT_FILE_WATCH_PATTERNS } from "./file_watcher.ts";
import path from "node:path";

const connection = createConnection();
const server = createServer(connection);
let projectFileWatcher: Disposable | undefined;

connection.listen();

connection.onInitialize(async (params) => {
  const tsdk = loadTsdkByPath(
    params.initializationOptions.typescript.tsdk,
    params.locale,
  );
  return server.initialize(
    params,
    createTypeScriptProject(tsdk.typescript, tsdk.diagnosticMessages, () => {
      return {
        languagePlugins: [
          createGtsLanguagePlugin(tsdk.typescript, {
            pathModule: path,
          }),
        ],
      };
    }),
    createLanguageServicePlugins(tsdk.typescript),
  );
});

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

process.on("uncaughtException", (err) => {
  console.error("Uncaught exception:", err);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled rejection at:", promise, "reason:", reason);
});
