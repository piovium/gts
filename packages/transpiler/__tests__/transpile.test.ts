import { test, expect } from "vitest";
import { parse } from "../src/parse/index.ts";
import { transform } from "../src/transform/index.ts";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

test("basic transpile pipeline", async () => {
  const SOURCE = await readFile(path.resolve(import.meta.dirname, "../../../examples/local/test.gts"), "utf8");
  const parsed = parse(SOURCE);
  const output = transform(
    parsed,
    {},
    { content: SOURCE, filename: "test.ts" },
  );

  expect(output.sourceMap?.mappings).toBeDefined();
  expect(output.sourceMap?.sources).toEqual(["test.ts"]);

  // console.log(output.code);
  await writeFile(
    path.resolve(import.meta.dirname, `../../../temp/test.js`),
    `${output.code}\n//# sourceMappingURL=${output.sourceMap.toUrl()}`,
  );
});
