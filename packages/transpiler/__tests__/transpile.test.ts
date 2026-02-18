import { test, expect } from "bun:test";
import { parse } from "../src/parse";
import { transform } from "../src/transform";
// @ts-expect-error no typings 
import SOURCE from "../../../examples/local/test.gts" with { type: "text" };

test("basic transpile pipeline", async () => {
  const parsed = parse(SOURCE);
  const output = transform(
    parsed,
    {},
    { content: SOURCE, filename: "test.ts" },
  );

  expect(output.sourceMap?.mappings).toBeDefined();
  expect(output.sourceMap?.sources).toEqual(["test.ts"]);

  console.log(output.code);
  Bun.write(
    `temp/test.js`,
    `${output.code}\n//# sourceMappingURL=${output.sourceMap.toUrl()}`,
  );
});
