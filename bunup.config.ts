import { defineWorkspace } from "bunup";

export default defineWorkspace(
  [
    {
      name: "transpiler",
      root: "packages/transpiler",
    },
    {
      name: "runtime",
      root: "packages/runtime",
    },
    {
      name: "unplugin",
      root: "packages/unplugin",
      config: [
        {
          name: "bun",
          target: "bun",
          entry: "src/bun.ts",
          clean: false,
        },
        {
          name: "esbuild",
          target: "node",
          entry: "src/esbuild.ts",
          clean: false,
        },
        {
          name: "rollup",
          target: "browser",
          entry: "src/rollup.ts",
          clean: false,
        },
        {
          name: "rolldown",
          target: "browser",
          entry: "src/rolldown.ts",
          clean: false,
        },
        {
          name: "rspack",
          target: "browser",
          entry: "src/rspack.ts",
          clean: false,
        },
        {
          name: "vite",
          target: "node",
          entry: "src/vite.ts",
          clean: false,
        },
        {
          name: "webpack",
          target: "node",
          entry: "src/webpack.ts",
          clean: false,
        },
      ],
    },
    {
      name: "language-plugin",
      root: "packages/language-plugin",
    },
    {
      name: "language-server",
      root: "packages/language-server",
      config: [
        {
          name: "node",
          entry: "src/node.ts",
          target: "node",
          clean: false,
        },
        {
          name: "browser",
          entry: "src/browser.ts",
          target: "browser",
          clean: false,
        },
      ],
    },
    {
      name: "tsc",
      root: "packages/tsc",
      config: {
        target: "node",
        dts: false,
      },
    },
    {
      name: "typescript-language-service-plugin",
      root: "packages/typescript-language-service-plugin",
      config: {
        target: "node",
        format: "cjs",
        dts: false,
      },
    },
    {
      name: "vscode",
      root: "packages/vscode",
      config: {
        entry: ["src/extension.ts", "src/server.ts"],
        target: "node",
        format: "cjs",
        dts: false,
        packages: "bundle",
        external: ["vscode"],
      },
    },
  ],
  {
    outDir: "dist",
    format: "esm",
    target: "browser",
    conditions: ["bun"],
    packages: "external",
  },
);
