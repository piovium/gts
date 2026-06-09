import {
  transpile,
  type TranspileOption,
  resolveGtsConfig,
  resolveGtsConfigSync,
} from "@gi-tcg/gts-transpiler";
import type { UnpluginFactory } from "unplugin";

export const unpluginFactory: UnpluginFactory<TranspileOption | undefined> = (
  option,
) => {
  return {
    name: "unplugin-gaming-ts",
    transform: {
      filter: { id: /\.gts$/ },
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

export interface TranspileSyncOption extends TranspileOption {
  readFileFn: (path: string, encoding: "utf8") => string;
}

export const unpluginSyncFactory: UnpluginFactory<TranspileSyncOption> = (
  option,
) => {
  return {
    name: "unplugin-gaming-ts",
    // The sync version used in unloader, have a following issue:
    // https://github.com/sxzz/unloader/issues/52
    // that requires an explicit load function. Lets define it now.
    load: {
      filter: { id: /\.gts$/ },
      handler(id) {
        return option.readFileFn(id, "utf8");
      },
    },
    transform: {
      filter: { id: /\.gts$/ },
      handler(source, id) {
        const { readFileFn, ...restOption } = option;
        const resolvedOption = resolveGtsConfigSync(id, restOption, {
          readFileFn,
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
