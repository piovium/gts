import { type LanguagePlugin } from "@volar/language-core";
import type * as ts from "typescript";
import { URI } from "vscode-uri";
import { GtsVirtualCode } from "./virtual_code";

import type {} from "@volar/typescript";

export interface GtsConfig {
  // runtimeImportSource?: string;
  providerImportSource?: string;
}

export function createGtsLanguagePlugin(commandLine?: ts.ParsedCommandLine): LanguagePlugin<URI | string> {
  const gtsConfig: Required<GtsConfig> = {
    providerImportSource: `@gi-tcg/core/gts`,
    ...commandLine?.raw?.gamingTs as GtsConfig | undefined,
  }
  return {
    getLanguageId(uri) {
      const path = typeof uri === "string" ? uri : uri.path;
      if (path.endsWith(".gts")) {
        return "gaming-ts";
      }
    },
    createVirtualCode(uri, languageId, snapshot) {
      const filename = typeof uri === "string" ? uri : uri.path;
      if (languageId === "gaming-ts") {
        return new GtsVirtualCode(filename, snapshot, gtsConfig);
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
