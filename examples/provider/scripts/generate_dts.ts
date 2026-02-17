/// <reference types="bun" />

import { rolldown } from "rolldown";
import { dts } from "rolldown-plugin-dts";

const ENTRIES = ["query", "vm", "runtime"];

for (const entry of ENTRIES) {
  await using bundle = await rolldown({
    input: `${import.meta.dirname}/../${entry}.ts`,
    external: entry === "runtime" ? [] : ["@gi-tcg/gts-runtime"],
    plugins: [
      dts({
        emitDtsOnly: true,
      }),

    ],
  });
  const { output } = await bundle.write({
    format: "esm",
    dir: `${import.meta.dirname}/../dist`,
    paths: {
      "@gi-tcg/gts-runtime": "./runtime",
    }
  });
  for (const chunk of output) {
    if (chunk.type === "chunk") {
      if (chunk.code.includes("/*elided*/")) {
        throw new Error(
          `Chunk ${chunk.fileName} contains "elided", which indicates an error in type generation.`,
        );
      }
    }
  }
}
