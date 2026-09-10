import {
  GtsTranspilerError,
  transpileForVolar,
  type GtsConfig,
} from "@gi-tcg/gts-transpiler";
import { type CodeMapping, type VirtualCode } from "@volar/language-core";
import type * as ts from "typescript";

/**
 * Replace every character of the source with a space, keeping the line breaks,
 * so code generated from it can be appended behind the source at Volar's
 * offsets. The text-only compiler host keeps the same layout.
 */
export function blankedSource(source: string): string {
  return source
    .split("\n")
    .map((line) => " ".repeat(line.length))
    .join("\n");
}

export class GtsVirtualCode implements VirtualCode {
  id = "root";
  languageId = "gaming-ts";
  mappings: CodeMapping[];
  snapshot: ts.IScriptSnapshot;
  errors: GtsTranspilerError[] = [];

  constructor(
    filename: string,
    snapshot: ts.IScriptSnapshot,
    config: Required<GtsConfig>,
  ) {
    const source = snapshot.getText(0, snapshot.getLength());
    try {
      const { code, mappings } = transpileForVolar(source, filename, config);
      this.mappings = mappings;
      this.snapshot = {
        getText: (start, end) => code.slice(start, end),
        getLength: () => code.length,
        getChangeRange: () => void 0,
      };
    } catch (e) {
      this.errors = [
        e instanceof GtsTranspilerError
          ? e
          : new GtsTranspilerError((e as Error)?.message, null),
      ];

      const emptyGeneration = blankedSource(source);
      this.mappings = [
        {
          sourceOffsets: [0],
          generatedOffsets: [0],
          lengths: [emptyGeneration.length],
          data: {
            verification: true,
          },
        },
      ];

      this.snapshot = {
        getText: (start, end) => emptyGeneration.substring(start, end),
        getLength: () => emptyGeneration.length,
        getChangeRange: () => void 0,
      };
    }
  }
}
