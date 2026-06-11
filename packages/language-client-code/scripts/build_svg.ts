/// <reference types="node" />

import { glob, readFile, writeFile } from "node:fs/promises";
import * as path from "node:path";

let output = "";

for await (const filename of await glob("svg/*.svg")) {
  const content = await readFile(filename, "utf-8");
  const name = path.basename(filename, ".svg");
  output += `export const ${name} = ${JSON.stringify(content)};\n`;
}
await writeFile("src/svg.ts", output);
