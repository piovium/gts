import { createLanguageServicePlugin } from "@volar/typescript/lib/quickstart/createLanguageServicePlugin";
import { createGtsLanguagePlugin } from "@gi-tcg/gts-language-plugin";

// Use CommonJS export to be compatible with TypeScript Language Service Plugin system
export = createLanguageServicePlugin((ts, info) => {
  return {
    languagePlugins: [createGtsLanguagePlugin(ts)],
  };
});
