import {
  createConnection,
  createServer,
  createTypeScriptProject,
  Diagnostic,
  loadTsdkByPath,
} from "@volar/language-server/node.js";
import { createGtsLanguagePlugin } from "@gi-tcg/gts-language-plugin";
import { createLanguageServicePlugins } from "./services/index.ts";
import path from "node:path";

const connection = createConnection();
const server = createServer(connection);

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

connection.onInitialized(server.initialized);

connection.onShutdown(server.shutdown);

process.on("uncaughtException", (err) => {
  console.error("Uncaught exception:", err);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled rejection at:", promise, "reason:", reason);
});
