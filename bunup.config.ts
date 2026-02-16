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
      name: "esbuild-plugin",
      root: "packages/esbuild-plugin",
      config: {
        target: "node",
      },
    },
    {
      name: "rollup-plugin",
      root: "packages/rollup-plugin",
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
          outDir: "dist/node",
          dts: false,
        },
        {
          name: "browser",
          entry: "src/browser.ts",
          target: "browser",
          outDir: "dist/browser",
          dts: false,
        },
      ]
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
