/// <reference lib="webworker" />
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
  const { tsdkUrl = "https://cdn.jsdelivr.net/npm/typescript@latest/lib" } =
    params.initializationOptions ?? {};
  const tsdk = await loadTsdkByUrl(tsdkUrl, params.locale);
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
