import { runTsc } from "@volar/typescript/lib/quickstart/runTsc.js";
import { createGtsLanguagePlugin } from "@gi-tcg/gts-language-plugin";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const tsdk = require.resolve("typescript");
const tscPath = require.resolve("typescript/lib/tsc", {
  paths: [tsdk],
});
runTsc(tscPath, [".gts"], (ts, options) => {
  const gtsLanguagePlugin = createGtsLanguagePlugin(ts, {
    pathModule: path,
    typeCheckingOnly: true,
  });
  return { languagePlugins: [gtsLanguagePlugin] };
});
