import { test, expect } from "bun:test";
import { findMinimalMissingString } from "../src/utils/minimal_missing_string";

test("findMinimalMissingString basic tests", () => {
  expect(findMinimalMissingString("banana", "abn")).toBe("aa");
});
