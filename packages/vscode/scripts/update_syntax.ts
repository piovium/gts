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

patched.repository["define-statement"] = {
  name: "meta.define.gts",
  begin:
    "(?<![_$[:alnum:]])(?:(?<=\\.\\.\\.)|(?<!\\.))\\b(define)\\b(?=\\s+|/[/*])",
  beginCaptures: {
    "1": {
      name: "storage.type.define.gts",
    },
  },
  end: "(?=;|^\\s*$|(?:^\\s*(?:abstract|async|(?:\\bawait\\s+(?:\\busing(?=\\s+(?!in\\b|of\\b(?!\\s*(?:of\\b|=)))[_$[:alpha:]])\\b)\\b)|break|case|catch|class|const|continue|declare|do|else|enum|export|finally|function|for|goto|if|import|interface|let|module|namespace|switch|return|throw|try|type|(?:\\busing(?=\\s+(?!in\\b|of\\b(?!\\s*(?:of\\b|=)))[_$[:alpha:]])\\b)|var|while)\\b))|(?<=\\})",
  patterns: [
    {
      include: "#statements",
    },
  ],
};
patched.repository["declaration"].patterns.push({
  include: "#define-statement",
});

patched.repository["expression-operators"].patterns.push({
  match:
    "(?<![_$[:alnum:]])(?:(?<=\\.\\.\\.)|(?<!\\.))(query)(?![_$[:alnum:]])(?:(?=\\.\\.\\.)|(?!\\.))(?:\\s*(\\*))?",
  captures: {
    "1": {
      name: "keyword.control.query.gts",
    },
    "2": {
      name: "keyword.control.query.asterisk.gts",
    },
  },
});

await Bun.write(
  `./syntaxes/GamingTS.tmLanguage.json`,
  JSON.stringify(patched, null, 2)
);

export {};
