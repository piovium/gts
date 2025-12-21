import { createLanguageServicePlugin } from "@volar/typescript/lib/quickstart/createLanguageServicePlugin";
import { gtsLanguagePlugin } from "@gi-tcg/gts-language-plugin";

module.exports = createLanguageServicePlugin(() => ({
  languagePlugins: [gtsLanguagePlugin],
}));
