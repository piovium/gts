import { createUnloaderPlugin, type UnpluginInstance } from "unplugin";
import { unpluginSyncFactory, type TranspileSyncOption } from "./unplugin.ts";

export default createUnloaderPlugin(
  unpluginSyncFactory,
) as UnpluginInstance<TranspileSyncOption, false>["unloader"];
