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

interface SourceMap {
  mappings: string;
}

interface CodePosition {
  line: number;
  column: number;
  end_line: number;
  end_column: number;
  code: string;
}

type LineOffsets = number[];

type CodeToGeneratedMap = Map<string, CodePosition[]>;

/**
 * Convert byte offset to line/column
 * @param offset
 * @param line_offsets
 * @returns  */
export const offset_to_line_col = (
  offset: number,
  line_offsets: LineOffsets
) => {
  // Binary search
  let left = 0;
  let right = line_offsets.length - 1;
  let line = 1;

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    if (
      offset >= line_offsets[mid] &&
      (mid === line_offsets.length - 1 || offset < line_offsets[mid + 1])
    ) {
      line = mid + 1;
      break;
    } else if (offset < line_offsets[mid]) {
      right = mid - 1;
    } else {
      left = mid + 1;
    }
  }

  const column = offset - line_offsets[line - 1];
  return { line, column };
};

/**
 * Build a source-to-generated position lookup map from an esrap source map
 * Applies post-processing adjustments during map building for efficiency
 * @param source_map - The source map object from esrap (v3 format)
 * @param line_offsets - Pre-computed line offsets array
 * @param generated_code - The final generated code (after post-processing)
 * @returns Tuple of [source-to-generated map, generated-to-source map]
 */
export function buildSrcToGenMap(
  source_map: SourceMap,
  line_offsets: LineOffsets,
  generated_code: string
) {
  const map: CodeToGeneratedMap = new Map();

  // Decode the VLQ-encoded mappings string
  const decoded = decode(source_map.mappings);

  /**
   * Convert line/column position to byte offset
   * @param {number} line - 1-based line number
   * @param {number} column - 0-based column number
   * @returns {number} Byte offset
   */
  const line_col_to_byte_offset = (line: number, column: number) => {
    return line_offsets[line - 1] + column;
  };

  // Apply post-processing adjustments to all segments first
  const adjusted_segments: {
    line: number;
    column: number;
    sourceLine: number;
    sourceColumn: number;
  }[][] = [];

  for (
    let generated_line = 0;
    generated_line < decoded.length;
    generated_line++
  ) {
    const line = decoded[generated_line];
    adjusted_segments[generated_line] = [];

    for (const segment of line) {
      if (segment.length >= 4) {
        let adjusted_line = generated_line + 1;
        let adjusted_column = segment[0];
        adjusted_segments[generated_line].push({
          line: adjusted_line,
          column: adjusted_column,
          sourceLine: segment[2]!,
          sourceColumn: segment[3]!,
        });
      }
    }
  }

  // Now build the map using adjusted positions
  for (let line_idx = 0; line_idx < adjusted_segments.length; line_idx++) {
    const line_segments = adjusted_segments[line_idx];

    for (let seg_idx = 0; seg_idx < line_segments.length; seg_idx++) {
      const segment = line_segments[seg_idx];
      const line = segment.line;
      const column = segment.column;

      // Determine end position using next segment
      let end_line = line;
      let end_column = column;

      // Look for next segment to determine end position
      if (seg_idx + 1 < line_segments.length) {
        // Next segment on same line
        const next_segment = line_segments[seg_idx + 1];
        end_line = next_segment.line;
        end_column = next_segment.column;
      } else if (
        line_idx + 1 < adjusted_segments.length &&
        adjusted_segments[line_idx + 1].length > 0
      ) {
        // Look at first segment of next line
        const next_segment = adjusted_segments[line_idx + 1][0];
        end_line = next_segment.line;
        end_column = next_segment.column;
      }

      // Extract code snippet
      const start_offset = line_col_to_byte_offset(line, column);
      const end_offset = line_col_to_byte_offset(end_line, end_column);
      const code_snippet = generated_code.slice(start_offset, end_offset);

      // Create key from source position (1-indexed line, 0-indexed column)
      segment.sourceLine += 1;
      const key = `${segment.sourceLine}:${segment.sourceColumn}`;

      // Store adjusted generated position with code snippet
      const gen_pos = {
        line,
        column,
        end_line,
        end_column,
        code: code_snippet,
        metadata: {},
      };

      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)!.push(gen_pos);
    }
  }

  return map;
}

/**
 * Look up generated position for a given source position
 * @param src_line - 1-based line number in source
 * @param src_column - 0-based column number in source
 * @param srcToGenMap - Lookup map
 * @returns Generated position
 */
export function getGeneratedPosition(
  src_line: number,
  src_column: number,
  srcToGenMap: CodeToGeneratedMap
) {
  const key = `${src_line}:${src_column}`;
  const positions = srcToGenMap.get(key);

  if (!positions || positions.length === 0) {
    // No mapping found in source map - this shouldn't happen since all tokens should have mappings
    // throw new Error(
    //   `No source map entry for position "${src_line}:${src_column}"`
    // );
  }

  // If multiple generated positions map to same source, return the first
  return positions?.[0];
}
// Helper to create a line-to-offset lookup table
function createLineOffsets(content: string): number[] {
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

/**
 * Convert line/column to byte offset
 * @param line
 * @param column
 * @param line_offsets
 * @returns
 */
function locToOffset(
  line: number,
  column: number,
  line_offsets: number[]
): number {
  if (line < 1 || line > line_offsets.length) {
    // throw new Error(
    //   `Location line or line offsets length is out of bounds, line: ${line}, line offsets length: ${line_offsets.length}`
    // );
  }
  return line_offsets[line - 1] + column;
}

export function convertToVolarMappings(
  generated: string,
  source: string,
  sourceMap: SourceMap,
  tokens: LeafToken[],
  additionalMappings: Map<string, string>
): CodeMapping[] {
  const sourceLineOffsets = createLineOffsets(source);
  const generatedLineOffsets = createLineOffsets(generated);
  const srcToGenMap = buildSrcToGenMap(
    sourceMap,
    generatedLineOffsets,
    generated
  );

  const mappings: CodeMapping[] = [];

  for (const token of tokens) {
    let sourceStart = locToOffset(
      token.loc.start.line,
      token.loc.start.column,
      sourceLineOffsets
    );
    const sourceEnd = locToOffset(
      token.loc.end.line,
      token.loc.end.column,
      sourceLineOffsets
    );
    let sourceLength = token.sourceLength ?? sourceEnd - sourceStart;
    const genLineCol = getGeneratedPosition(
      token.loc.start.line,
      token.loc.start.column,
      srcToGenMap
    );
    if (!genLineCol) {
      // No mapping found for this token - skip it
      continue;
    }
    let genStart = locToOffset(
      genLineCol.line,
      genLineCol.column,
      generatedLineOffsets
    );
    if (token.locationAdjustment) {
      // maps verification back to the start of source
      mappings.push({
        sourceOffsets: [sourceStart],
        generatedOffsets: [genStart],
        lengths: [0],
        generatedLengths: [token.locationAdjustment.generatedLength],
        data: {
          verification: true,
        },
      });
      genStart += token.locationAdjustment.startOffset;
    }
    if (token.isDummy) {
      // A dummy token might be generated for a missing property / argument.
      // Notice that when facing this scenario, the parser tries to 'defer' and step through
      // all whitespaces and insert the invalid node just before the next token.
      // But in a mapping context, we need the caret next to the previous token (commonly the `.` dot)
      // to allow triggering completion correctly. So we adjust the sourceStart and sourceLength accordingly.
      // After adjustment, the mapping will include all whitespaces as the invalid node and maps to an empty string.
      while (sourceStart > 0 && /\s/.test(source[sourceStart - 1])) {
        sourceStart--;
        sourceLength++;
      }
    }

    const generatedLength = token.generatedLength ?? sourceLength;

    mappings.push({
      sourceOffsets: [sourceStart],
      generatedOffsets: [genStart],
      lengths: [sourceLength],
      generatedLengths: [generatedLength],
      data: DEFAULT_VOLAR_MAPPING_DATA,
    });
  }

  for (const [loc, codeSnippet] of additionalMappings) {
    const generatedStart = generated.indexOf(codeSnippet);
    if (generatedStart === -1) {
      continue;
    }
    const [lineStr, columnStr] = loc.split(":");
    const line = Number(lineStr);
    const column = Number(columnStr);
    const sourceStart = locToOffset(line, column, sourceLineOffsets);
    const sourceLength = 1;
    const generatedLength = codeSnippet.length;
    mappings.push({
      sourceOffsets: [sourceStart],
      generatedOffsets: [generatedStart],
      lengths: [sourceLength],
      generatedLengths: [generatedLength],
      data: {
        verification: true,
      },
    });
  }

  // Sort mappings by source offset	// Sort mappings by source offset
  mappings.sort((a, b) => a.sourceOffsets[0] - b.sourceOffsets[0]);

  return mappings;
}
