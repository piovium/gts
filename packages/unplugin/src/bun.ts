import { createBunPlugin, type UnpluginInstance } from "unplugin";
import { unpluginFactory } from "./unplugin";
import type { TranspileOption } from "@gi-tcg/gts-transpiler";

export default createBunPlugin(
  unpluginFactory,
) as UnpluginInstance<TranspileOption | undefined>["bun"];
