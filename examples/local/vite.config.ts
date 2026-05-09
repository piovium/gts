import { defineConfig, type Plugin } from "vite";
import gts from "@gi-tcg/unplugin-gts/vite";

export default defineConfig({
  plugins: [gts()],
});
