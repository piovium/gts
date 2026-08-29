import type * as ts from "typescript";

export function findImportedGtsFiles(
  ts: typeof import("typescript"),
  project: ts.server.Project,
): string[] {
  const roots = new Set<string>(project.getFileNames());
  if (project.projectKind === ts.server.ProjectKind.Configured) {
    const configFile = project.getProjectName();
    const config = ts.readJsonConfigFile(
      configFile,
      project.readFile.bind(project),
    );
    const parseHost: ts.ParseConfigHost = {
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

  for (const containingFile of queue) {
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

function resolveGtsImport(
  containingFile: string,
  specifier: string,
): string | undefined {
  try {
    const resolved = require.resolve(specifier, { paths: [containingFile] });
    if (resolved.toLowerCase().endsWith(".gts")) {
      return resolved;
    }
  } catch {}
}
