import {
  createGtsLanguagePlugin,
  createTnbGetSourceText,
  type TnbTextHost,
} from "@gi-tcg/gts-language-plugin";
import type { Language } from "@volar/language-core";
import path from "node:path";
import type ts from "typescript";

type Ts = typeof ts;

/**
 * The Volar project descriptor behind `gtsc`.
 *
 * `gtsc` compiles on a plain compiler host, which exposes neither Volar
 * snapshots nor editor overlays, so this descriptor installs the
 * `tnbGetSourceText` hook, through which the native bridge reads text and
 * script kind instead of parsing a JavaScript `SourceFile` per file.
 */
export function createGtscProject(
  typescript: Ts,
  options: ts.CreateProgramOptions,
) {
  return {
    languagePlugins: [
      createGtsLanguagePlugin(typescript, { pathModule: path }),
    ],
    setup(language: Language<string>): void {
      const host = options.host as TnbTextHost | undefined;
      if (host !== undefined) {
        host.tnbGetSourceText = createTnbGetSourceText(
          typescript,
          host,
          language,
        );
      }
    },
  };
}
