import { createUnplugin, type UnpluginInstance } from "unplugin";
import { unpluginFactory } from "./unplugin.ts";
import type { TranspileOption } from "@gi-tcg/gts-transpiler";

export default createUnplugin(unpluginFactory) as UnpluginInstance<
  TranspileOption | undefined,
  false
>;

export type { TranspileSyncOption } from "./unplugin.ts";
export type * from "@gi-tcg/gts-transpiler";
