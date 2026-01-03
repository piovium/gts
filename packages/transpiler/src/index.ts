import { parse, parseLoose } from "./parse";
import {
  transform,
  transformForVolar,
  type TranspileResult,
} from "./transform";
import type { TranspileOption } from "./transform/gts";
import type { VolarMappingResult } from "./transform/volar";
export { GtsTranspilerError } from "./error";

export function transpile(
  source: string,
  filename: string,
  option: TranspileOption
): TranspileResult {
  const ast = parse(source);
  return transform(ast, option, {
    content: source,
    filename,
  });
}

export function transpileForVolar(
  source: string,
  filename: string,
  option: TranspileOption
): VolarMappingResult {
  const ast = parseLoose(source);
  return transformForVolar(ast, option, {
    content: source,
    filename,
  });
}

export type { TranspileOption, TranspileResult, VolarMappingResult };
