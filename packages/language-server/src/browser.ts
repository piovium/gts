import {
  createConnection,
  createServer,
  createTypeScriptProject,
  Diagnostic,
  loadTsdkByUrl,
} from "@volar/language-server/browser.js";
import { createGtsLanguagePlugin } from "@gi-tcg/gts-language-plugin";
import { createDiagnosticsPlugin } from "./diagnostics";
import { createTypeScriptServices } from "./typescript";

const connection = createConnection();
const server = createServer(connection);

connection.listen();

connection.onInitialize(async (params) => {
  const { typescript = "https://cdn.jsdelivr.net/npm/typescript@latest/lib" } =
    params.initializationOptions;
  const tsdk = await loadTsdkByUrl(typescript.tsdkUrl, params.locale);
  return server.initialize(
    params,
    createTypeScriptProject(tsdk.typescript, tsdk.diagnosticMessages, () => {
      return {
        languagePlugins: [createGtsLanguagePlugin(tsdk.typescript)],
      };
    }),
    [...createTypeScriptServices(tsdk.typescript), createDiagnosticsPlugin()],
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
