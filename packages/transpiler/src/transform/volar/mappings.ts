import { decode } from "@jridgewell/sourcemap-codec";
import type { CodeInformation, CodeMapping } from "@volar/language-core";
import type { LeafToken } from "./collect_tokens";

export interface VolarMappingResult {
  code: string;
  mappings: CodeMapping[];
}

const DEFAULT_VOLAR_MAPPING_DATA: CodeInformation = {
  completion: true,
  format: true,
  navigation: true,
  semantic: true,
  structure: true,
  verification: true,
};

// Helper to create a line-to-offset lookup table
function createOffsetLookup(content: string): number[] {
  const lines = content.split("\n");
  const offsets: number[] = [];
  let currentOffset = 0;

  for (const line of lines) {
    offsets.push(currentOffset);
    // +1 for the newline character (handle \r\n vs \n if necessary)
    currentOffset += line.length + 1;
  }

  return offsets;
}

interface SourceMap {
  mappings: string;
}

export function convertToVolarMappings(
  code: string,
  source: string,
  sourceMap: SourceMap,
  tokens: LeafToken[]
): CodeMapping[] {
  const decodedLines = decode(sourceMap.mappings);
  const volarMappings: CodeMapping[] = [];

  // 1. Prepare offset lookups
  const generatedLineOffsets = createOffsetLookup(code);
  const sourceLineOffsets = createOffsetLookup(source);

  // 2. Iterate over the decoded standard mappings
  decodedLines.forEach((segments, genLineIndex) => {
    const genLineStartOffset = generatedLineOffsets[genLineIndex];

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      const nextSegment = segments[i + 1];

      // Standard map segment: [genCol, sourceIndex, sourceLine, sourceCol, nameIndex]
      // We only care about mapped segments (length 4 or 5)
      if (segment.length === 4 || segment.length === 5) {
        const [genCol, sourceIndex, sourceLine, sourceCol] = segment;

        let generatedOffset = genLineStartOffset + genCol;
        const sourceOffset = sourceLineOffsets[sourceLine] + sourceCol;

        // Calculate Length
        // Standard maps are points, Volar maps are ranges.
        // We infer length by looking at the next segment's start or end of line.
        let length = 0;
        const token = tokens.find(
          (t) =>
            t.loc.start.line - 1 === sourceLine &&
            t.loc.start.column === sourceCol
        );
        if (token) {
          const tokenEndCol = token.loc.end.column;
          length = tokenEndCol - sourceCol;
          generatedOffset += token.locationAdjustment?.startOffset ?? 0;
        } else if (nextSegment) {
          length = nextSegment[0] - genCol;
        } else {
          // If it's the last segment in the line, length goes to end of line
          // (You might need logic here to exclude newline chars depending on exact needs)
          const lineLength = Math.min(
            (sourceLineOffsets[sourceLine + 1] || source.length + 1) -
              1 -
              sourceLineOffsets[sourceLine],
            (generatedLineOffsets[genLineIndex + 1] || code.length + 1) -
              1 -
              genLineStartOffset
          );
          length = lineLength - genCol;
        }

        // 3. Construct the Volar Mapping
        volarMappings.push({
          sourceOffsets: [sourceOffset],
          generatedOffsets: [generatedOffset],
          lengths: [length],
          data: DEFAULT_VOLAR_MAPPING_DATA, // Populate with specific data if your tooling needs semantic info
        });
      }
    }
  });

  return volarMappings;
}
