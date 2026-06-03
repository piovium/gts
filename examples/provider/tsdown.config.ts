import type { UserConfig } from "tsdown";

export default ["vm.ts", "runtime.ts"].map<UserConfig>((entry) => ({
  platform: "neutral",
  format: "esm",
  entry,
  deps: {
    alwaysBundle: ["@gi-tcg/gts-runtime"],
  },
  dts: { emitDtsOnly: true },
}));
