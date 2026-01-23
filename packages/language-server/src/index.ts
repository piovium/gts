import {
  createConnection,
  createServer,
  createTypeScriptProject,
  Diagnostic,
  loadTsdkByPath,
} from "@volar/language-server/node";
import { readFileSync } from "node:fs";
import { create as createTypeScriptServices } from "volar-service-typescript";
import { createGtsLanguagePlugin } from "@gi-tcg/gts-language-plugin";
import type ts from "typescript";
import path from "node:path";
import { createDiagnosticsPlugin } from "./diagnostics";

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
    createTypeScriptProject(
      tsdk.typescript,
      tsdk.diagnosticMessages,
      () => {
        return {
          languagePlugins: [createGtsLanguagePlugin(tsdk.typescript)],
        };
      },
    ),
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
