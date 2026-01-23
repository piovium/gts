import {
  transpile,
  type TranspileOption,
  resolveGtsConfig,
} from "@gi-tcg/gts-transpiler";
import type { Plugin } from "rollup";

export function gts(option: TranspileOption = {}): Plugin {
  return {
    name: "rollup-plugin-gaming-ts",

    async load(id) {
      if (!id.endsWith(".gts")) {
        return null;
      }
      try {
        const sourceCode = await this.fs.readFile(id, { encoding: "utf8" });
        const resolvedOption = await resolveGtsConfig(id, option, {
          readFileFn: (path, encoding) => this.fs.readFile(path, { encoding }),
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
