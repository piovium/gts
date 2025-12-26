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
          languagePlugins: [
            createGtsLanguagePlugin(commandLine),
          ],
        };
      }
    ),
    [
      ...createTypeScriptServices(tsdk.typescript),
      // createDocumentHighlightPlugin(),
    ]
  );
});

connection.onInitialized(server.initialized);

connection.onShutdown(server.shutdown);
