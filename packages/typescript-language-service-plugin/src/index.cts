import { createLanguageServicePlugin } from "@volar/typescript/lib/quickstart/createLanguageServicePlugin";
import { gtsLanguagePlugin } from "@gi-tcg/gts-language-plugin";

// Use CommonJS export to be compatible with TypeScript Language Service Plugin system
module.exports = createLanguageServicePlugin(() => ({
  languagePlugins: [gtsLanguagePlugin],
}));
