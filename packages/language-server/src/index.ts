import {
  createConnection,
  createServer,
  createTypeScriptProject,
  Diagnostic,
  loadTsdkByPath,
} from "@volar/language-server/node";
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
    params.locale
  );
  return server.initialize(
    params,
    createTypeScriptProject(
      tsdk.typescript,
      tsdk.diagnosticMessages,
      ({ configFileName }) => {
        let commandLine: ts.ParsedCommandLine | undefined;
        if (configFileName) {
          const cwd = path.dirname(configFileName);
          const configFile = tsdk.typescript.readJsonConfigFile(
            configFileName,
            tsdk.typescript.sys.readFile
          );
          commandLine = tsdk.typescript.parseJsonSourceFileConfigFileContent(
            configFile,
            tsdk.typescript.sys,
            cwd
          );
        }
        return {
          languagePlugins: [createGtsLanguagePlugin(commandLine)],
        };
      }
    ),
    [
      ...createTypeScriptServices(tsdk.typescript),
      createDiagnosticsPlugin(),
    ]
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
