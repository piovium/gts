// https://github.com/microsoft/vscode-typescript-next/blob/main/build/updateGrammar.js

import * as PLIST from "fast-plist";

function removeDom(grammar: any) {
  grammar.repository["support-objects"].patterns = grammar.repository[
    "support-objects"
  ].patterns.filter((pattern: any) => {
    if (
      pattern.match &&
      pattern.match.match(
        /\b(HTMLElement|ATTRIBUTE_NODE|stopImmediatePropagation)\b/g
      )
    ) {
      return false;
    }
    return true;
  });
  return grammar;
}

function removeNodeTypes(grammar: any) {
  grammar.repository["support-objects"].patterns = grammar.repository[
    "support-objects"
  ].patterns.filter((pattern: any) => {
    if (pattern.name) {
      if (
        pattern.name.startsWith("support.variable.object.node") ||
        pattern.name.startsWith("support.class.node.")
      ) {
        return false;
      }
    }
    if (pattern.captures) {
      if (
        Object.values(pattern.captures).some(
          (capture: any) =>
            capture.name &&
            (capture.name.startsWith("support.variable.object.process") ||
              capture.name.startsWith("support.class.console"))
        )
      ) {
        return false;
      }
    }
    return true;
  });
  return grammar;
}
function patchJsdoctype(grammar: any) {
  grammar.repository["jsdoctype"].patterns = grammar.repository[
    "jsdoctype"
  ].patterns.filter((pattern: any) => {
    if (pattern.name && pattern.name.includes("illegal")) {
      return false;
    }
    return true;
  });
  return grammar;
}

const content = await fetch(
  `https://raw.githubusercontent.com/Microsoft/TypeScript-TmLanguage/master/TypeScript.tmLanguage`
).then((res) => res.text());

const grammar = PLIST.parse(content);
const patched = removeNodeTypes(removeDom(patchJsdoctype(grammar)));

patched.name = "GamingTS";
patched.scopeName = "source.gts";
delete patched.fileTypes;

await Bun.write(
  `./syntaxes/GamingTS.tmLanguage.json`,
  JSON.stringify(patched, null, 2)
);

export {};
