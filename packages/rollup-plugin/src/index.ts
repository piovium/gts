// @ts-check
import fs from "node:fs/promises";
import { transpile, type TranspileOption } from "@gi-tcg/gts-transpiler";
import type { Plugin } from "rollup";

export function gts(option: TranspileOption = {}): Plugin {
  return {
    name: "rollup-plugin-gaming-ts",

    async load(id) {
      // 1. Filter: Only process files ending in .gts
      if (!id.endsWith(".gts")) {
        return null;
      }

      try {
        // 2. Read: Read the file content
        const sourceCode = await fs.readFile(id, "utf8");

        // 3. Transpile: Call the transpiler
        const { code, sourceMap } = transpile(sourceCode, id, option);

        // 4. Return: Return code with source map
        return {
          code,
          map: sourceMap,
        };
      } catch (error) {
        this.error((error as Error).message);
      }
    },
  };
}
