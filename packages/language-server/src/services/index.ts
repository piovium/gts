import { createCodeLensPlugin } from "./code_lens.ts";
import { createCompletionPlugin } from "./completion.ts";
import { createDiagnosticsPlugin } from "./diagnostics.ts";
import { createSemanticTokensPlugin } from "./semantic_tokens.ts";
import { createTypeScriptServices } from "./typescript.ts";
import type { LanguageServicePlugin } from "@volar/language-server";

export function createLanguageServicePlugins(
  ts: typeof import("typescript"),
): LanguageServicePlugin[] {
  return [
    ...createTypeScriptServices(ts),
    createDiagnosticsPlugin(),
    createCompletionPlugin(),
    createSemanticTokensPlugin(),
    createCodeLensPlugin(),
  ];
}
