import { gts } from "./packages/esbuild-plugin/src/index.ts";

Bun.plugin(gts({
        "providerImportSource": "~provider",
        "runtimeImportSource": "~runtime"
    }) as any as Bun.BunPlugin);
