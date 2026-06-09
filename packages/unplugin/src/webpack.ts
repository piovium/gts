import { createWebpackPlugin, type UnpluginInstance } from "unplugin";
import { unpluginFactory } from "./unplugin.ts";
import type { TranspileOption } from "@gi-tcg/gts-transpiler";

export default createWebpackPlugin(unpluginFactory) as UnpluginInstance<
  TranspileOption | undefined,
  false
>["webpack"];
