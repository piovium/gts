type TypeScript = typeof import("typescript/lib/tsserverlibrary");
type Project = import("typescript/lib/tsserverlibrary").server.Project;

interface FindImportedGtsFilesOptions {
  openFilesOnly?: boolean;
}

function findImportedGtsFiles(
  ts: TypeScript,
  project: Project,
  options: FindImportedGtsFilesOptions = {},
): string[] {
  const compilerOptions = project.getCompilerOptions();
  const roots = options.openFilesOnly
    ? getOpenFileNames(ts, project)
    : new Set<string>(project.getFileNames());
  if (
    !options.openFilesOnly
    && project.projectKind === ts.server.ProjectKind.Configured
  ) {
    const configFile = project.getProjectName();
    const config = ts.readJsonConfigFile(
      configFile,
      project.readFile.bind(project),
    );
    const parseHost: import("typescript").ParseConfigHost = {
      useCaseSensitiveFileNames: project.useCaseSensitiveFileNames(),
      fileExists: project.fileExists.bind(project),
      readFile: project.readFile.bind(project),
      readDirectory: project.readDirectory.bind(project),
    };
    const parsed = ts.parseJsonSourceFileConfigFileContent(
      config,
      parseHost,
      project.getCurrentDirectory(),
    );
    for (const fileName of parsed.fileNames) {
      roots.add(fileName);
    }
  }

  const queue = [...roots];
  const checked = new Set<string>();
  const result = new Set(
    queue.filter((fileName) => fileName.toLowerCase().endsWith(".gts")),
  );

  for (let index = 0; index < queue.length; index++) {
    const containingFile = queue[index];
    if (checked.has(containingFile)) {
      continue;
    }
    checked.add(containingFile);

    let text: string | undefined;
    try {
      text = project.readFile(containingFile);
    } catch {
      continue;
    }
    if (!text?.includes(".gts")) {
      continue;
    }
    const imports = ts.preProcessFile(text, true, true).importedFiles;
    for (const imported of imports) {
      if (!imported.fileName.toLowerCase().endsWith(".gts")) {
        continue;
      }
      const resolvedFileName = resolveGtsImport(
        ts,
        project,
        compilerOptions,
        containingFile,
        imported.fileName,
      );
      if (resolvedFileName && !result.has(resolvedFileName)) {
        result.add(resolvedFileName);
        queue.push(resolvedFileName);
      }
    }
  }

  return [...result];
}

function getOpenFileNames(ts: TypeScript, project: Project): Set<string> {
  const result = new Set<string>();
  for (const path of project.projectService.openFiles.keys()) {
    const scriptInfo = project.projectService.getScriptInfoForPath(path);
    if (
      scriptInfo?.fileName
      && (
        project.isRoot(scriptInfo)
        || scriptInfo.containingProjects.includes(project)
        || isConfiguredProjectFile(ts, project, scriptInfo)
      )
    ) {
      result.add(scriptInfo.fileName);
    }
  }
  return result;
}

function isConfiguredProjectFile(
  ts: TypeScript,
  project: Project,
  scriptInfo: import("typescript/lib/tsserverlibrary").server.ScriptInfo,
): boolean {
  if (project.projectKind !== ts.server.ProjectKind.Configured) {
    return false;
  }
  const projectService = project.projectService as typeof project.projectService & {
    getConfigFileNameForFile?(
      info: typeof scriptInfo,
      findFromCacheOnly: boolean,
    ): string | undefined;
  };
  return projectService.getConfigFileNameForFile?.(scriptInfo, false)
    === project.getProjectName();
}

function resolveGtsImport(
  ts: TypeScript,
  project: Project,
  compilerOptions: import("typescript").CompilerOptions,
  containingFile: string,
  specifier: string,
): string | undefined {
  try {
    const resolved = ts.resolveModuleName(
      specifier,
      containingFile,
      compilerOptions,
      project,
    ).resolvedModule?.resolvedFileName;
    if (resolved?.toLowerCase().endsWith(".gts")) {
      return resolved;
    }
  } catch {}

  try {
    const resolved =
      require("node:module").createRequire(containingFile).resolve(specifier);
    if (resolved.toLowerCase().endsWith(".gts")) {
      return resolved;
    }
  } catch {}
}

module.exports = { findImportedGtsFiles };
