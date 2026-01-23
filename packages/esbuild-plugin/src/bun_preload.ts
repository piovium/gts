/// <reference types="bun" />
import { gts } from "./index";

Bun.plugin(
  gts({
    providerImportSource: process.env.GTS_PROVIDER_IMPORT_SOURCE,
    runtimeImportSource: process.env.GTS_RUNTIME_IMPORT_SOURCE,
  }) as any,
);
