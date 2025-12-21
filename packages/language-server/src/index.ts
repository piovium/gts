import {
  createConnection,
  createServer,
  createTypeScriptProject,
  Diagnostic,
  loadTsdkByPath,
} from "@volar/language-server/node";
import { create as createTypeScriptServices } from "volar-service-typescript";
import { gtsLanguagePlugin } from "@gi-tcg/gts-language-plugin";

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
    createTypeScriptProject(tsdk.typescript, tsdk.diagnosticMessages, () => ({
      languagePlugins: [gtsLanguagePlugin],
    })),
    [
      ...createTypeScriptServices(tsdk.typescript),
      // createDocumentHighlightPlugin(),
    ]
  );
});

connection.onInitialized(server.initialized);

connection.onShutdown(server.shutdown);
