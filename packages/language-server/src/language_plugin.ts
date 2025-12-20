import {
  type CodeMapping,
  forEachEmbeddedCode,
  type LanguagePlugin,
  type VirtualCode,
} from "@volar/language-core";
import type * as ts from "typescript";
import { URI } from "vscode-uri";

import { transpileForVolar } from "@gi-tcg/gts-transpiler";

export const gtsLanguagePlugin: LanguagePlugin<URI> = {
  getLanguageId(uri) {
    if (uri.path.endsWith(".gts")) {
      return "gaming-ts";
    }
  },
  createVirtualCode(_uri, languageId, snapshot) {
    if (languageId === "gaming-ts") {
      return new GtsVirtualCode(snapshot);
    }
  },
  typescript: {
    extraFileExtensions: [
      {
        extension: "gts",
        isMixedContent: false,
        scriptKind: 7 satisfies ts.ScriptKind.Deferred,
      },
    ],
    getServiceScript(root) {
      if (root instanceof GtsVirtualCode) {
        return {
          code: root,
          extension: ".ts",
          scriptKind: 3 satisfies ts.ScriptKind.TS,
        };
      }
    },
  },
};

export class GtsVirtualCode implements VirtualCode {
  id = "root";
  languageId = "gaming-ts";
  mappings: CodeMapping[];
  snapshot: ts.IScriptSnapshot;

  constructor(snapshot: ts.IScriptSnapshot) {
    const source = snapshot.getText(0, snapshot.getLength());
    try {
      const { code, mappings } = transpileForVolar(source, "");
      this.mappings = mappings;
      this.snapshot = {
        getLength: () => code.length,
        getText: (start, end) => code.slice(start, end),
        getChangeRange: () => void 0,
      };
    } catch (e) {
      console?.log(e);
      // Create 1:1 mappings for the entire content
      this.mappings = [
        {
          sourceOffsets: [0],
          generatedOffsets: [0],
          lengths: [source.length],
          data: {},
        },
      ];

      this.snapshot = {
        getText: (start, end) => source.substring(start, end),
        getLength: () => source.length,
        getChangeRange: () => void 0,
      };
    }
  }
}
