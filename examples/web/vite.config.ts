import { defineConfig } from "vite";

export default defineConfig({
  worker: {
    format: "es",
  },
  resolve: {
    // espolar have a "development" entry that points to ...
    // non-exist *.ts files. The fallback seems not working
    conditions: ["import", "default"],
  },
});
