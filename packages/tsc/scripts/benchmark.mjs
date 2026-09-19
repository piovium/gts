#!/usr/bin/env node

// Run after building @gi-tcg/gtsc and its dependencies. Accepts tsc arguments.
import { createRequire } from "node:module";
import path from "node:path";
import { runTsc } from "@volar/typescript/lib/quickstart/runTsc.js";
import { createGtsLanguagePlugin } from "@gi-tcg/gts-language-plugin";

const require = createRequire(import.meta.url);
const tscPath = createRequire(require.resolve("typescript")).resolve(
  "typescript/lib/tsc",
);
const files = new Map();

process.on("exit", () => {
  const totals = {
    files: files.size,
    sourceBytes: 0,
    generatedBytes: 0,
    mappings: 0,
  };
  for (const file of files.values()) {
    totals.sourceBytes += file.sourceBytes;
    totals.generatedBytes += file.generatedBytes;
    totals.mappings += file.mappings;
  }
  console.log("GTS generation:", JSON.stringify(totals));
  console.log("Peak RSS (KiB):", process.resourceUsage().maxRSS);
});

runTsc(tscPath, [".gts"], (ts) => {
  const plugin = createGtsLanguagePlugin(ts, {
    pathModule: path,
    typeCheckingOnly: true,
  });
  const createVirtualCode = plugin.createVirtualCode.bind(plugin);
  plugin.createVirtualCode = (id, languageId, snapshot, context) => {
    const code = createVirtualCode(id, languageId, snapshot, context);
    if (code) {
      files.set(id, {
        sourceBytes: Buffer.byteLength(
          snapshot.getText(0, snapshot.getLength()),
        ),
        generatedBytes: Buffer.byteLength(
          code.snapshot.getText(0, code.snapshot.getLength()),
        ),
        mappings: code.mappings.length,
      });
    }
    return code;
  };
  return { languagePlugins: [plugin] };
});
