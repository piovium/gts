/// <reference types="node" />

import { test, expect } from "vitest";
import { parse } from "../src/parse/index.ts";
import { transform } from "../src/transform/index.ts";
import { readFile } from "node:fs/promises";
import path from "node:path";

test("basic transpile pipeline", async () => {
  // The snapshot embeds sourcesContent. Keep Git's checkout EOL setting out of it.
  const SOURCE = (await readFile(
    path.resolve(import.meta.dirname, "../../../examples/local/test.gts"),
    "utf8",
  )).replaceAll("\r\n", "\n");
  const parsed = parse(SOURCE);
  const output = transform(
    parsed,
    {},
    { content: SOURCE, filename: "test.gts" },
  );

  expect(output.sourceMap?.mappings).toBeDefined();
  expect(output.sourceMap?.sources).toEqual(["test.gts"]);

  expect(
    `${output.code}\n//# sourceMappingURL=${output.sourceMap.toUrl()}`,
  ).toMatchSnapshot();
  // console.log(output.code);
  // await writeFile(
  //   path.resolve(import.meta.dirname, `../../../temp/test.js`),
  //   ,
  // );
});
