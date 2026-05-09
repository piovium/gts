import {
  transpile,
  type TranspileOption,
  resolveGtsConfig,
} from "@gi-tcg/gts-transpiler";
import type { UnpluginFactory } from "unplugin";

export const unpluginFactory: UnpluginFactory<TranspileOption | undefined> = (option) => {
  return {
    name: "rollup-plugin-gaming-ts",
    transform: {
      filter: {
        id: /\.gts$/,
      },
      async handler(source, id) {
        const resolvedOption = await resolveGtsConfig(id, option ?? {}, {
          readFileFn: (path, encoding) =>
            this.fs.readFile(path, { encoding }) as Promise<string>,
        });
        const { code, sourceMap } = transpile(source, id, resolvedOption);
        return {
          code,
          map: sourceMap,
        };
      },
    },
  };
};
