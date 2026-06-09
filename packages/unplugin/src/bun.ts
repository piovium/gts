import { createBunPlugin, type UnpluginInstance } from "unplugin";
import { unpluginFactory } from "./unplugin.ts";
import type { TranspileOption } from "@gi-tcg/gts-transpiler";

export default createBunPlugin(
  unpluginFactory,
) as UnpluginInstance<TranspileOption | undefined, false>["bun"];
