import type { Program } from "estree";
import { eraseTs } from "./erase_ts";
import { print } from "esrap";
import jsPrinter from "esrap/languages/ts";
import type { SourceMap } from "magic-string";
import { gtsToTs, type TranspileOption } from "./gts";

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

export { transformForVolar } from "./volar";
