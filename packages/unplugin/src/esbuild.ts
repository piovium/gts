import { createEsbuildPlugin, type UnpluginInstance } from "unplugin";
import { unpluginFactory } from "./unplugin";
import type { TranspileOption } from "@gi-tcg/gts-transpiler";

export default createEsbuildPlugin(
  unpluginFactory,
) as UnpluginInstance<TranspileOption | undefined>["esbuild"];
