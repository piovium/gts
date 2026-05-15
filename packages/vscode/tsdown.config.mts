import type { UserConfig } from "tsdown";

export default {
  entry: ["src/extension.ts", "src/server.ts"],
  platform: "node",
  format: "cjs",
  fixedExtension: false,
  dts: false,
  deps: {
    neverBundle: "vscode",
  },
} satisfies UserConfig;
