import type { Node, Program, EmptyStatement } from "estree";
import { walk } from "zimmerframe";
import { eraseTs } from "./erase_ts";
import { print } from "esrap";
import jsPrinter from "esrap/languages/ts";
import type { SourceMap } from "magic-string";
import { gtsToTs } from "./gts";

export interface TranspileResult {
  code: string;
  sourceMap: SourceMap;
}

export interface SourceInfo {
  content?: string;
  filename?: string;
}

export function transpile(ast: Program, sourceInfo: SourceInfo = {}): TranspileResult {

  const ts = gtsToTs(ast);
  const js = eraseTs(ts);
  const { code, map } = print(js, jsPrinter(), {
    sourceMapContent: sourceInfo.content,
    sourceMapSource: sourceInfo.filename,
  });
  return {
    code,
    sourceMap: map,
  };
}
