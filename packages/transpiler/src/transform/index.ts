import type { Program } from "estree";
import { eraseTs } from "./erase_ts";
import { print } from "esrap";
import jsPrinter from "esrap/languages/ts";
import type { SourceMap } from "magic-string";
import { gtsToTs, type TranspileOption } from "./gts";
import { gtsToTypings, convertToVolarMappings } from "./gts_for_volar";
import type { VolarMappingResult } from "./gts_for_volar";

export interface TranspileResult {
  code: string;
  sourceMap: SourceMap;
}

export interface SourceInfo {
  content?: string;
  filename?: string;
}

export function transform(
  ast: Program,
  option: TranspileOption = {},
  sourceInfo: SourceInfo = {}
): TranspileResult {
  const ts = gtsToTs(ast, option);
  const js = eraseTs(ts);
  const { code, map } = print(js, jsPrinter(), {
    indent: "  ",
    sourceMapContent: sourceInfo.content,
    sourceMapSource: sourceInfo.filename,
  });
  return {
    code,
    sourceMap: map,
  };
}

export function transformForVolar(
  ast: Program,
  option: TranspileOption,
  sourceInfo: Required<SourceInfo>
): VolarMappingResult {
  const { code, sourceMap } = gtsToTypings(ast);
  const volarMappings = convertToVolarMappings(
    code,
    sourceInfo.content,
    sourceMap
  );
  return {
    code,
    mappings: volarMappings,
  };
}
