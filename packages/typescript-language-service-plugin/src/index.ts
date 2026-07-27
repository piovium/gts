import createLanguageServicePluginMod = require("@volar/typescript/lib/quickstart/createLanguageServicePlugin.js");
import createGtsLanguagePluginMod = require("@gi-tcg/gts-language-plugin");
import type * as ts from "typescript";
import externalFilesMod = require("./external_files.ts");

declare module "typescript" {
  var createTsgoProgram: unknown;
}

const { createLanguageServicePlugin } = createLanguageServicePluginMod;
const { createGtsLanguagePlugin } = createGtsLanguagePluginMod;

type Project = ts.server.Project;
const { findImportedGtsFiles } = externalFilesMod;

// Use CommonJS export to be compatible with TypeScript Language Service Plugin system
const createPlugin = createLanguageServicePlugin((ts, info) => {
  return {
    languagePlugins: [
      createGtsLanguagePlugin(ts, {
        pathModule: require("node:path"),
      }),
    ],
  };
});

const plugin: ts.server.PluginModuleFactory = (modules) => {
  const plugin = createPlugin(modules);
  const getExternalFiles = plugin.getExternalFiles;
  const importedExternalFiles = new WeakMap<Project, string[]>();
  const isNativeBridge = typeof modules.typescript.createTsgoProgram === "function";

  return {
    ...plugin,
    getExternalFiles(project: Project, updateLevel = 0) {
      const externalFiles = isNativeBridge
        ? []
        : (getExternalFiles?.(project, updateLevel) ?? []);
      if (updateLevel >= 1 || !importedExternalFiles.has(project)) {
        try {
          importedExternalFiles.set(
            project,
            findImportedGtsFiles(modules.typescript, project, {
              openFilesOnly: isNativeBridge,
            }),
          );
        } catch (error) {
          console.error(
            "[GamingTS] Failed to collect imported GTS files",
            error,
          );
          importedExternalFiles.set(project, []);
        }
      }
      return [
        ...new Set([
          ...externalFiles,
          ...(importedExternalFiles.get(project) ?? []),
        ]),
      ];
    },
  };
};

export = plugin;
