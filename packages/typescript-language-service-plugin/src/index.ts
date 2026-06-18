const { createLanguageServicePlugin } =
  require("@volar/typescript/lib/quickstart/createLanguageServicePlugin.js") as typeof import("@volar/typescript/lib/quickstart/createLanguageServicePlugin.js");
const { createGtsLanguagePlugin } =
  require("@gi-tcg/gts-language-plugin") as typeof import("@gi-tcg/gts-language-plugin");

// Use CommonJS export to be compatible with TypeScript Language Service Plugin system
module.exports = createLanguageServicePlugin((ts, info) => {
  return {
    languagePlugins: [
      createGtsLanguagePlugin(ts, {
        pathModule: require("node:path"),
      }),
    ],
  };
});
