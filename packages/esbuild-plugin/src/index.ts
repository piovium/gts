// @ts-check
import fs from "node:fs/promises";
import path from "node:path";
import { transpile, type TranspileOption } from "@gi-tcg/gts-transpiler";
import type { Plugin } from "esbuild";

export function gts(option: TranspileOption = {}): Plugin {
  return {
    name: "esbuild-plugin-gaming-ts",
    setup(build) {
      // 1. Filter: Tell esbuild to listen for files ending in .my-lang
      build.onLoad({ filter: /\.gts$/ }, async (args) => {
        try {
          // 2. Read: Manually read the file (esbuild doesn't pass content automatically)
          const sourceCode = await fs.readFile(args.path, "utf8");

          // 3. Transpile: Call your API
          const { code, sourceMap } = transpile(sourceCode, args.path, option);
          const mappingUrl = sourceMap.toUrl();

          // 4. Return: Specify the contents and the loader type ('js')
          return {
            contents: `${code}\n//# sourceMappingURL=${mappingUrl}`,
            loader: "js", // Tells esbuild to treat the output as JavaScript
            resolveDir: path.dirname(args.path), // Helps resolve imports inside the new JS
          };
        } catch (error) {
          return {
            errors: [{ text: (error as Error).message }],
          };
        }
      });
    },
  };
}
