import {
  createConnection,
  createServer,
  createTypeScriptProject,
  Diagnostic,
  loadTsdkByPath,
} from "@volar/language-server/node.js";
import { createGtsLanguagePlugin } from "@gi-tcg/gts-language-plugin";
import { createDiagnosticsPlugin } from "./diagnostics";
import { createTypeScriptServices } from "./typescript";
import { createCompletionPlugin } from "./completion";

const connection = createConnection();
const server = createServer(connection);

connection.listen();

connection.onInitialize((params) => {
  const tsdk = loadTsdkByPath(
    params.initializationOptions.typescript.tsdk,
    params.locale,
  );
  return server.initialize(
    params,
    createTypeScriptProject(tsdk.typescript, tsdk.diagnosticMessages, () => {
      return {
        languagePlugins: [createGtsLanguagePlugin(tsdk.typescript)],
      };
    }),
    [
      ...createTypeScriptServices(tsdk.typescript),
      createDiagnosticsPlugin(),
      createCompletionPlugin(),
    ],
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
