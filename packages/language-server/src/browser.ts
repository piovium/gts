/// <reference lib="webworker" />
import {
  createConnection,
  createServer,
  createTypeScriptProject,
  Diagnostic,
  FileType,
  loadTsdkByUrl,
  type InitializeParams,
} from "@volar/language-server/browser.js";
import { createGtsLanguagePlugin } from "@gi-tcg/gts-language-plugin";
import { path, type GtsConfig } from "@gi-tcg/gts-transpiler";
import { createDiagnosticsPlugin } from "./diagnostics";
import { createTypeScriptServices } from "./typescript";
import { createCompletionPlugin } from "./completion";
import { Dirent, fs as memfs } from "@zenfs/core";
import ts from "typescript";

export interface GtsLanguageServerBrowserInitializationOptions {
  tsdkUrl?: string;
  inlineGtsConfig?: GtsConfig;
  inlineCompilerOptions?: ts.CompilerOptions;
  fs?: Record<string, string>;
}

const connection = createConnection();
const server = createServer(connection);

connection.listen();

type AnyTuple = [unknown, ...unknown[]];

connection.onInitialize(
  async (
    params: Omit<InitializeParams, "initializationOptions"> & {
      initializationOptions?: GtsLanguageServerBrowserInitializationOptions;
    },
  ) => {
    const {
      tsdkUrl = "https://cdn.jsdelivr.net/npm/typescript@latest/lib",
      fs = {},
      inlineGtsConfig = {},
      inlineCompilerOptions = {},
    } = params.initializationOptions ?? {};
    const tsdk = await loadTsdkByUrl(tsdkUrl, params.locale);
    for (const [filepath, content] of Object.entries(fs)) {
      memfs.mkdirSync(path.dirname(filepath), { recursive: true });
      memfs.writeFileSync(filepath, content);
    }
    return server.initialize(
      params,
      createTypeScriptProject(
        tsdk.typescript,
        tsdk.diagnosticMessages,
        ({ env }) => {
          const { fs } = env;
          env.fs = {
            stat: (uri) => {
              if (uri.scheme === "file") {
                try {
                  const memFsResult = memfs.statSync(uri.path);
                  const result = {
                    type: memFsResult.isDirectory()
                      ? FileType.Directory
                      : FileType.File,
                    ctime: memFsResult.ctimeMs,
                    mtime: memFsResult.mtimeMs,
                    size: memFsResult.size,
                  };
                  return result;
                } catch {
                  // ignore
                }
              }
              return fs?.stat(uri);
            },
            readDirectory: async (uri) => {
              const result = (await fs?.readDirectory(uri)) ?? [];
              if (uri.scheme === "file") {
                try {
                  const memFsResult = memfs.readdirSync(uri.path, {
                    withFileTypes: true,
                  }) as Dirent[];
                  result.push(
                    ...memFsResult.map(
                      (dirent) =>
                        [
                          dirent.name as string,
                          dirent.isDirectory()
                            ? FileType.Directory
                            : FileType.File,
                        ] satisfies AnyTuple,
                    ),
                  );
                } catch {
                  // ignore
                }
              }
              return result;
            },
            readFile: (uri) => {
              if (uri.scheme === "file") {
                try {
                  return memfs.readFileSync(uri.path, "utf-8") as string;
                } catch {
                  // ignore
                }
              }
              return fs?.readFile(uri);
            },
          };
          return {
            languagePlugins: [createGtsLanguagePlugin(tsdk.typescript, inlineGtsConfig)],
          };
        },
      ),
      [
        ...createTypeScriptServices(tsdk.typescript),
        createDiagnosticsPlugin(),
        createCompletionPlugin(),
      ],
    );
  },
);

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
