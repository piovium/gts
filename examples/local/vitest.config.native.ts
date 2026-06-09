import { defineConfig } from "vitest/config";
import * as path from "path";

// not work, wondering why
export default defineConfig({
  test: {
    experimental: {
      viteModuleRunner: false,
    },
    execArgv: [
      "--import",
      path.resolve(import.meta.dirname, "./node_preload.ts"),
    ],
  },
  ssr: {
    resolve: {
      externalConditions: ["node", "import", "default"],
    }
  }
});
