import fs from "node:fs/promises";
import path from "node:path";
import {
  resolveGtsConfigSync,
  type GtsConfig,
  transpile,
  type TranspileOption,
} from "@gi-tcg/gts-transpiler";
import type { Plugin as EsBuildPlugin } from "esbuild";
import type { BunPlugin } from "bun";
import { readFileSync } from "node:fs";

export function gts(option: TranspileOption = {}): EsBuildPlugin & BunPlugin {
  return {
    name: "esbuild-plugin-gaming-ts",
    setup(build) {
      build.onLoad({ filter: /\.gts$/ }, async (args) => {
        try {
          const sourceCode = await fs.readFile(args.path, "utf8");
          const resolvedOption = resolveGtsConfigSync(args.path, option, {
            cwd: process.cwd(),
            readFileFn: readFileSync,
          });
          const { code, sourceMap } = transpile(
            sourceCode,
            args.path,
            resolvedOption,
          );
          const mappingUrl = sourceMap.toUrl();
          return {
            contents: `${code}\n//# sourceMappingURL=${mappingUrl}`,
            loader: "js", // Tells esbuild to treat the output as JavaScript
            resolveDir: path.dirname(args.path), // Helps resolve imports inside the new JS
          };
        } catch (error) {
          console.log(error);
          return {
            contents: "",
            errors: [{ text: (error as Error).message }],
          };
        }
      });
    },
  };
}
