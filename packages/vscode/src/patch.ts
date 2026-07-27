import * as vscode from "vscode";
import {
  isTsserverFile,
  transformTsserver,
} from "./tsserver_proxy";

// https://github.com/vuejs/language-tools/blob/master/extensions/vscode/src/extension.ts#L274
export function patchTypeScriptExtension() {
  const tsExtension = vscode.extensions.getExtension(
    "vscode.typescript-language-features",
  );
  if (!tsExtension) {
    console.error("[GamingTS] TypeScript extension not found");
    return true;
  }
  if (tsExtension.isActive) {
    console.log("[GamingTS] TypeScript extension is already active, skipping patch");
    return false;
  }

  const fs = require("node:fs");
  const child_process = require("node:child_process");
  const readFileSync = fs.readFileSync;
  const extensionJsPath = require.resolve("./dist/extension.js", {
    paths: [tsExtension.extensionPath],
  });

  const tsPluginName = "@gi-tcg/gts-typescript-language-service-plugin";

  fs.readFileSync = (...args: any[]) => {
    if (args[0] === extensionJsPath) {
      let text = readFileSync(...args) as string;

      const id = String.raw`[\w$]+(?:\.[\w$]+)?`;
      // patch jsTsLanguageModes
      // before 1.110: t.jsTsLanguageModes=[t.javascript,t.javascriptreact,t.typescript,t.typescriptreact]
      // since 1.110:  "javascriptreact",Oh=[Ma,Ua,bl,Ns]
      text = text.replace(
        new RegExp(
          String.raw`(\.jsTsLanguageModes=\[${id},${id},${id},${id}\])|("javascriptreact",(${id})=\[(${id},${id},${id},${id})\])`,
        ),
        (_match, oldFormat, _newFull, newLhs, newElements) => {
          if (oldFormat) {
            return oldFormat + '.concat("gaming-ts")';
          }
          return `"javascriptreact",${newLhs}=[${newElements}].concat("gaming-ts")`;
        },
      );
      // patch isSupportedLanguageMode (4 language IDs)
      // before 1.110: .languages.match([t.typescript,t.typescriptreact,t.javascript,t.javascriptreact]
      // since 1.110:  .languages.match([bl,Ns,Ma,Ua],r)>0
      text = text.replace(
        new RegExp(
          String.raw`\.languages\.match\(\[(${id},${id},${id},${id})\]`,
        ),
        (_, ids) => `.languages.match([${ids}].concat("gaming-ts")`,
      );
      // patch isTypeScriptDocument (2 language IDs)
      // before 1.110: .languages.match([t.typescript,t.typescriptreact]
      // since 1.110:  .languages.match([bl,Ns],r)>0
      text = text.replace(
        new RegExp(String.raw`\.languages\.match\(\[(${id},${id})\]`),
        (_, ids) => `.languages.match([${ids}].concat("gaming-ts")`,
      );
      // patch standardFileExtensions
      text = text.replace(
        new RegExp(
          String.raw`registerExtensionLanguageProvider\((${id}),${id}\)\{`,
        ),
        (match, id) =>
          `${match}if(${id}.languageIds.includes("gaming-ts"))${id}.standardFileExtensions.push("gts");`,
      );
      // patch getJsTsFileBeingMoved
      text = text.replace(
        new RegExp(
          String.raw`.RelativePattern\(${id},"\*\*\/\*\.\{ts,tsx,js,jsx`,
        ),
        (match) => `${match},gts`,
      );

      // sort plugins for johnsoncodehk.tsslint, zardoy.ts-essential-plugins
      // before 1.110: "--globalPlugins",i.plugins
      // since 1.110:  "--globalPlugins",o.plugins.map(v=>v.name).join(","))
      text = text.replace(
        /"--globalPlugins",([\w$]+)\.plugins/,
        (s) =>
          s +
          `.sort((a,b)=>(b.name==="${tsPluginName}"?-1:0)-(a.name==="${tsPluginName}"?-1:0))`,
      );

      return text;
    }
    return readFileSync(...args);
  };
  const spawn = child_process.spawn;
  child_process.spawn = (...args: any[]) => {
    if (Array.isArray(args[1])) {
      const index = args[1].findIndex(
        (arg) => typeof arg === "string" && isTsserverFile(arg),
      );
      if (index !== -1) {
        args[1][index] = transformTsserver(args[1][index]);
        console.log("[GamingTS] Patched tsserver path in child_process.spawn", args);
      }
    }
    return spawn(...args);
  };

  const fork = child_process.fork;
  child_process.fork = (...args: any[]) => {
    if (typeof args[0] === "string" && isTsserverFile(args[0])) {
      args[0] = transformTsserver(args[0]);
      console.log("[GamingTS] Patched tsserver path in child_process.fork", args);
    }
    return fork(...args);
  };

  const loadedModule = require.cache[extensionJsPath];
  if (loadedModule) {
    delete require.cache[extensionJsPath];
    const patchedModule = require(extensionJsPath);
    Object.assign(loadedModule.exports, patchedModule);
  }
  console.log("[GamingTS] Patched TypeScript extension");
  return true;
}
