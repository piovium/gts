import { defineConfig } from "vitest/config";
import gts from "@gi-tcg/unplugin-gts/vite";

export default defineConfig({
  plugins: [gts()],
});
