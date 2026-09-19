import { runTsc } from "@volar/typescript/lib/quickstart/runTsc.js";
import { createGtsLanguagePlugin } from "@gi-tcg/gts-language-plugin";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
// Resolve from the compiler API so aliases that wrap another TypeScript
// package (such as @typescript/typescript6) reach the actual compiler.
const tscPath = createRequire(require.resolve("typescript")).resolve(
  "typescript/lib/tsc",
);
runTsc(tscPath, [".gts"], (ts, options) => {
  const gtsLanguagePlugin = createGtsLanguagePlugin(ts, {
    pathModule: path,
    typeCheckingOnly: true,
  });
  return { languagePlugins: [gtsLanguagePlugin] };
});
