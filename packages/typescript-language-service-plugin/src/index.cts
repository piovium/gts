import { createLanguageServicePlugin } from "@volar/typescript/lib/quickstart/createLanguageServicePlugin";
import { createGtsLanguagePlugin } from "@gi-tcg/gts-language-plugin";
import type ts from "typescript";

// Use CommonJS export to be compatible with TypeScript Language Service Plugin system
export = createLanguageServicePlugin((ts, info) => {
  const configFile = info.project.getCompilerOptions().configFile as
    | ts.TsConfigSourceFile
    | undefined;
  let commandLine: ts.ParsedCommandLine | undefined;
  if (configFile) {
    const cwd = info.project.getCurrentDirectory();
    commandLine = ts.parseJsonSourceFileConfigFileContent(
      configFile,
      ts.sys,
      cwd
    );
  }
  return {
    languagePlugins: [createGtsLanguagePlugin(commandLine)],
  };
});
