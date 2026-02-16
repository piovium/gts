import { defineConfig } from "vite";
import solid from "vite-plugin-solid";

export default defineConfig({
  plugins: [solid()],
  optimizeDeps: {
    exclude: [
      "@codingame/monaco-vscode-theme-defaults-default-extension",
      "@codingame/monaco-vscode-textmate-service-override",
    ],
  },
});
