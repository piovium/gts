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
        let configFile: ts.TsConfigSourceFile | undefined;
        if (configFileName) {
          configFile = tsdk.typescript.readJsonConfigFile(
            configFileName,
            tsdk.typescript.sys.readFile
          );
        }
        return {
          languagePlugins: [
            createGtsLanguagePlugin(tsdk.typescript, configFile),
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
