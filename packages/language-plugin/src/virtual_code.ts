import { GtsTranspilerError, transpileForVolar } from "@gi-tcg/gts-transpiler";
import { type CodeMapping, type VirtualCode } from "@volar/language-core";
import type * as ts from "typescript";
import type { GtsConfig } from "./language_plugin";

export class GtsVirtualCode implements VirtualCode {
  id = "root";
  languageId = "gaming-ts";
  mappings: CodeMapping[];
  snapshot: ts.IScriptSnapshot;
  errors: GtsTranspilerError[] = [];

  constructor(
    filename: string,
    snapshot: ts.IScriptSnapshot,
    config: Required<GtsConfig>
  ) {
    const source = snapshot.getText(0, snapshot.getLength());
    try {
      const { code, mappings } = transpileForVolar(source, filename, config);
      this.errors = [];
      this.mappings = mappings;
      this.snapshot = {
        getText: (start, end) => code.slice(start, end),
        getLength: () => code.length,
        getChangeRange: () => void 0,
      };
    } catch (e) {
      if (e instanceof GtsTranspilerError) {
        this.errors = [e];
      } else {
        this.errors = [new GtsTranspilerError((e as Error)?.message, null)];
      }

      const emptyGeneration = source
        .split("\n")
        .map((line) => " ".repeat(line.length))
        .join("\n");
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
