import { expect, test } from "vitest";

test("import GTS should work", async () => {
  const module = await import("./test.gts");
  expect(module.Barbara).toBe(1201);
})
