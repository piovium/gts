import { defineConfig, type Plugin } from "vite";
import { gts } from "@gi-tcg/gts-rollup-plugin";

export default defineConfig({
  plugins: [gts() as Plugin],
});
