import { describe, expect, test } from "vitest";
import { getContentStartOffset } from "../src/transform/volar/content_start.ts";

describe("getContentStartOffset", () => {
  test("multiple comments with hashbang", () => {
    const code = `#!/usr/bin/env node
// leading comment 1
/* leading comment 2 */
// leading comment 3
define x {
  foo bar;
}
`;
    const offset = getContentStartOffset(code);
    const expectedOffset = code.indexOf("define");
    expect(offset).toBe(expectedOffset);
  });
  test("multiple comments without hashbang, skipping leading whitespaces", () => {
    const code = `
    

// leading comment 1
/* leading comment 2 */
// leading comment 3
define x {
  foo bar;
}
`;
    const offset = getContentStartOffset(code);
    const expectedOffset = code.indexOf("define");
    expect(offset).toBe(expectedOffset);
  });

  test("stop at adjacent newlines", () => {
    const code = `
// leading comment 1

/* leading comment 2 */
define x {
  foo bar;
}
`;
    const offset = getContentStartOffset(code);
    const expectedOffset = code.indexOf("comment 1") + "comment 1".length + 1; // stop at the newline after comment 1
    expect(offset).toBe(expectedOffset);
  });
});
