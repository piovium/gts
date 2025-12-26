import { transpileForVolar } from "@gi-tcg/gts-transpiler";
import { type CodeMapping, type VirtualCode } from "@volar/language-core";
import type * as ts from "typescript";
import type { GtsConfig } from "./language_plugin";

export class GtsVirtualCode implements VirtualCode {
  id = "root";
  languageId = "gaming-ts";
  mappings: CodeMapping[];
  snapshot: ts.IScriptSnapshot;

  constructor(filename: string, snapshot: ts.IScriptSnapshot, config: Required<GtsConfig>) {
    const source = snapshot.getText(0, snapshot.getLength());
    try {
      const { code, mappings } = transpileForVolar(source, filename, config);
      this.mappings = mappings;
      this.snapshot = {
        getLength: () => code.length,
        getText: (start, end) => code.slice(start, end),
        getChangeRange: () => void 0,
      };
    } catch (e) {
      console?.log(e);
      // Create 1:1 mappings for the entire content
      this.mappings = [
        {
          sourceOffsets: [0],
          generatedOffsets: [0],
          lengths: [source.length],
          data: {},
        },
      ];

      this.snapshot = {
        getText: (start, end) => source.substring(start, end),
        getLength: () => source.length,
        getChangeRange: () => void 0,
      };
    }
  }
}
