import { test, expect } from "vitest";
import { findMinimalMissingString } from "../src/utils/minimal_missing_string.ts";

test("findMinimalMissingString basic tests", () => {
  expect(findMinimalMissingString("banana", "abn")).toBe("aa");
});
