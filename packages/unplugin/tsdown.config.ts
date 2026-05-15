import type { UserConfig } from "tsdown";

const nodeEntries: UserConfig = {
  entry: [
    "src/bun.ts",
    "src/esbuild.ts",
    "src/vite.ts",
    "src/webpack.ts",
  ],
  platform: "node",
  fixedExtension: false,
  dts: true,
}

const neutralEntries: UserConfig = {
  entry: [
    "src/index.ts",
    "src/rollup.ts",
    "src/rolldown.ts",
    "src/rspack.ts",
  ],
  platform: "neutral",
  fixedExtension: false,
  dts: true,
}

export default [nodeEntries, neutralEntries] as UserConfig[];
