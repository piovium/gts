import { type LanguagePlugin } from "@volar/language-core";
import type * as ts from "typescript";
import { URI } from "vscode-uri";
import { GtsVirtualCode } from "./virtual_code";

import type {} from "@volar/typescript";

export function createGtsLanguagePlugin(ts: typeof import("typescript"), configFile?: ts.TsConfigSourceFile): LanguagePlugin<URI | string> {
  return {
    getLanguageId(uri) {
      const path = typeof uri === "string" ? uri : uri.path;
      if (path.endsWith(".gts")) {
        return "gaming-ts";
      }
    },
    createVirtualCode(uri, languageId, snapshot) {
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
        if (root.languageId === "gaming-ts") {
          return {
            code: root,
            extension: ".ts",
            scriptKind: 3 satisfies ts.ScriptKind.TS,
          };
        }
      },
    },
  };
}
