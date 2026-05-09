import { createRolldownPlugin, type UnpluginInstance } from "unplugin";
import { unpluginFactory } from "./unplugin";
import type { TranspileOption } from "@gi-tcg/gts-transpiler";

export default createRolldownPlugin(
  unpluginFactory,
) as UnpluginInstance<TranspileOption | undefined>["rolldown"];
