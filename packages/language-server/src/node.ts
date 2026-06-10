import {
  createConnection,
  createServer,
  createTypeScriptProject,
  Diagnostic,
  loadTsdkByPath,
} from "@volar/language-server/node.js";
import { createGtsLanguagePlugin } from "@gi-tcg/gts-language-plugin";
import { createDiagnosticsPlugin } from "./diagnostics.ts";
import { createTypeScriptServices } from "./typescript.ts";
import { createCompletionPlugin } from "./completion.ts";
import { createSemanticTokensPlugin } from "./semantic_tokens.ts";

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
      createSemanticTokensPlugin(),
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
