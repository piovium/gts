import { createVitePlugin, type UnpluginInstance } from "unplugin";
import { unpluginFactory } from "./unplugin.ts";
import type { TranspileOption } from "@gi-tcg/gts-transpiler";

export default createVitePlugin(
  unpluginFactory,
) as UnpluginInstance<TranspileOption | undefined, false>["vite"];
