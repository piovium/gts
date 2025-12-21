import * as vscode from "vscode";

export function patchTypeScriptExtension() {
  const tsExtension = vscode.extensions.getExtension(
    "vscode.typescript-language-features"
  );
  if (!tsExtension) {
    // TS extension not found, nothing to do
    return true;
  }
  if (tsExtension.isActive) {
    return false;
  }

  const fs = require("node:fs");
  const readFileSync = fs.readFileSync;
  const extensionJsPath = require.resolve("./dist/extension.js", {
    paths: [tsExtension.extensionPath],
  });

  const tsPluginName = "@gi-tcg/gts-typescript-language-service-plugin";

  fs.readFileSync = (...args: any[]) => {
    if (args[0] === extensionJsPath) {
      let text = readFileSync(...args) as string;

      // patch jsTsLanguageModes
      text = text.replace(
        "t.jsTsLanguageModes=[t.javascript,t.javascriptreact,t.typescript,t.typescriptreact]",
        (s) => s + '.concat("gaming-ts")'
      );
      // patch isSupportedLanguageMode
      text = text.replace(
        ".languages.match([t.typescript,t.typescriptreact,t.javascript,t.javascriptreact]",
        (s) => s + '.concat("gaming-ts")'
      );
      // patch isTypeScriptDocument
      text = text.replace(
        ".languages.match([t.typescript,t.typescriptreact]",
        (s) => s + '.concat("gaming-ts")'
      );

      // sort plugins
      text = text.replace(
        '"--globalPlugins",i.plugins',
        (s) =>
          s +
          `.sort((a,b)=>(b.name==="${tsPluginName}"?-1:0)-(a.name==="${tsPluginName}"?-1:0))`
      );

      return text;
    }
    return readFileSync(...args);
  };

  const loadedModule = require.cache[extensionJsPath];
  if (loadedModule) {
    delete require.cache[extensionJsPath];
    const patchedModule = require(extensionJsPath);
    Object.assign(loadedModule.exports, patchedModule);
  }
  console?.log("[GamingTS] Patched TypeScript extension");
  return true;
}
