import { register } from "unloader";
import gts from "@gi-tcg/unplugin-gts/unloader";
import { readFileSync } from "node:fs";

register({
  plugins: [
    gts({
      readFileFn: readFileSync,
    }),
  ],
});
