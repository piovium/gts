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
 * Besides the GTS language plugin it installs the text-only host capability
 * `typescript-native-bridge` reads. `gtsc` runs on a plain compiler host rather
 * than a language-service snapshot host, so without that capability the bridge
 * builds a JavaScript `SourceFile` for every file only to read text the virtual
 * code already has. Answering from the GTS virtual code keeps the native
 * program from parsing each file twice.
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
