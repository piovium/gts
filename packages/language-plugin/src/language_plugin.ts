import { type LanguagePlugin } from "@volar/language-core";
import type * as ts from "typescript";
import { URI } from "vscode-uri";
import { resolveGtsConfig, type GtsConfig } from "@gi-tcg/gts-transpiler";
import { GtsVirtualCode } from "./virtual_code";

import type {} from "@volar/typescript";
import type { ResolveGtsConfigOptions } from "../../transpiler/src/config";

export function createGtsLanguagePlugin(
  ts: typeof import("typescript"),
): LanguagePlugin<URI | string> {
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
        const resolvedConfig = resolveGtsConfig(
          filename,
          {},
          {
            cwd: ts.sys.getCurrentDirectory(),
            readFileFn: (path, encoding) =>
              ts.sys.readFile(path, encoding) || "",
          },
        );
        return new GtsVirtualCode(filename, snapshot, resolvedConfig);
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
