// @ts-check
import fs from "node:fs/promises";
import {
  resolveGtsConfigSync,
  type GtsConfig,
  transpile,
  type TranspileOption,
} from "@gi-tcg/gts-transpiler";
import type { Plugin } from "rollup";
import { readFileSync } from "node:fs";

export function gts(option: TranspileOption = {}): Plugin {
  return {
    name: "rollup-plugin-gaming-ts",

    async load(id) {
      if (!id.endsWith(".gts")) {
        return null;
      }

      try {
        const sourceCode = await fs.readFile(id, "utf8");
        this.fs.readFile;
        const resolvedOption = resolveGtsConfigSync(id, option, {
          readFileFn: readFileSync,
        });
        const { code, sourceMap } = transpile(sourceCode, id, resolvedOption);
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
