import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { expect, test, vi } from "vitest";
import { tsdk } from "./fixture.ts";
import { loadTypeScriptLibs } from "../src/browser_libs.ts";

test("browser libraries include the active SDK's complete declaration graph", async () => {
  const files = new Map<string, string>();
  const fetchLibrary = vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(async (url) => {
      const file = path.join(
        tsdk,
        path.basename(new URL(String(url)).pathname),
      );
      return existsSync(file)
        ? new Response(readFileSync(file, "utf8"))
        : new Response("missing", { status: 404 });
    });
  try {
    await loadTypeScriptLibs(ts, "https://sdk.test/lib", (name, content) =>
      files.set(name, content),
    );
    expect(files.get("lib.es5.d.ts")).toContain("type Omit<");
    expect(files.has("lib.es2025.d.ts")).toBe(true);
    for (const content of files.values()) {
      for (const reference of ts.preProcessFile(content)
        .libReferenceDirectives) {
        expect(
          files.has(`lib.${reference.fileName.toLowerCase()}.d.ts`),
          reference.fileName,
        ).toBe(true);
      }
    }
    expect(fetchLibrary.mock.calls.length).toBe(files.size);
  } finally {
    fetchLibrary.mockRestore();
  }
});

test("a missing browser declaration library fails initialization explicitly", async () => {
  const fetchLibrary = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(new Response("not found", { status: 404 }));
  try {
    await expect(
      loadTypeScriptLibs(ts, "https://sdk.test/lib", () => {}),
    ).rejects.toThrow(/Cannot load TypeScript library .*: HTTP 404/);
  } finally {
    fetchLibrary.mockRestore();
  }
});
