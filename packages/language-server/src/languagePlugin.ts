import {
  type CodeMapping,
  forEachEmbeddedCode,
  type LanguagePlugin,
  type VirtualCode,
} from "@volar/language-core";
import type { TypeScriptExtraServiceScript } from "@volar/typescript";
import type * as ts from "typescript";
import { URI } from "vscode-uri";

export const gtsLanguagePlugin: LanguagePlugin<URI> = {
  getLanguageId(uri) {
    if (uri.path.endsWith(".gts")) {
      return "gts";
    }
  },
  createVirtualCode(_uri, languageId, snapshot) {
    if (languageId === "gts") {
      return new GtsVirtualCode(snapshot);
    }
  },
  typescript: {
    extraFileExtensions: [
      {
        extension: "gts",
        isMixedContent: true,
        scriptKind: 7 satisfies ts.ScriptKind.Deferred,
      },
    ],
    getServiceScript() {
      return undefined;
    },
    getExtraServiceScripts(fileName, root) {
      const scripts: TypeScriptExtraServiceScript[] = [];
      for (const code of forEachEmbeddedCode(root)) {
        if (code.languageId === "typescript") {
          scripts.push({
            fileName: fileName + "." + code.id + ".ts",
            code,
            extension: ".ts",
            scriptKind: 3 satisfies ts.ScriptKind.TS,
          });
        }
      }
      return scripts;
    },
  },
};

export class GtsVirtualCode implements VirtualCode {
  id = "root";
  languageId = "gts";
  mappings: CodeMapping[];
  embeddedCodes: VirtualCode[] = [];

  constructor(public snapshot: ts.IScriptSnapshot) {
    this.mappings = [
      {
        sourceOffsets: [0],
        generatedOffsets: [0],
        lengths: [snapshot.getLength()],
        data: {
          completion: true,
          format: true,
          navigation: true,
          semantic: true,
          structure: true,
          verification: true,
        },
      },
    ];
    this.embeddedCodes = [getGtsEmbeddedCode(snapshot)];
  }
}

function getGtsEmbeddedCode(snapshot: ts.IScriptSnapshot): VirtualCode {
  return {
    id: "script",
    languageId: "typescript",
    snapshot,
    mappings: [
      {
        sourceOffsets: [0],
        generatedOffsets: [0],
        lengths: [snapshot.getLength()],
        data: {
          completion: true,
          format: true,
          navigation: true,
          semantic: true,
          structure: true,
          verification: true,
        },
      },
    ],
    embeddedCodes: [],
  };
}
