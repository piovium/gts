import type { UserConfig } from "tsdown";

export default [
  {
    entry: "src/node.ts",
    platform: "node",
    fixedExtension: false,
    dts: true,
  },
  {
    entry: "src/browser.ts",
    platform: "browser",
    fixedExtension: false,
    dts: true,
  },
] satisfies UserConfig[];
