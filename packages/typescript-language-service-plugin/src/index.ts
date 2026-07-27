const { createLanguageServicePlugin } =
  require("@volar/typescript/lib/quickstart/createLanguageServicePlugin.js") as typeof import("@volar/typescript/lib/quickstart/createLanguageServicePlugin.js");
const { createGtsLanguagePlugin } =
  require("@gi-tcg/gts-language-plugin") as typeof import("@gi-tcg/gts-language-plugin");

type TypeScript = typeof import("typescript/lib/tsserverlibrary");
type Project = import("typescript/lib/tsserverlibrary").server.Project;
const { findImportedGtsFiles } = require("./external_files") as {
  findImportedGtsFiles(
    ts: TypeScript,
    project: Project,
    options?: { openFilesOnly?: boolean },
  ): string[];
};

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

module.exports = ((modules: Parameters<typeof createPlugin>[0]) => {
  const plugin = createPlugin(modules);
  const getExternalFiles = plugin.getExternalFiles;
  const importedExternalFiles = new WeakMap<Project, string[]>();
  const isNativeBridge =
    typeof (modules.typescript as TypeScript & {
      createTsgoProgram?: unknown;
    }).createTsgoProgram === "function";

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
          console.error("[GamingTS] Failed to collect imported GTS files", error);
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
}) satisfies typeof createPlugin;
