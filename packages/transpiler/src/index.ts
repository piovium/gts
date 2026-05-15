import { parse, parseLoose } from "./parse/index.ts";
import {
  transform,
  transformForVolar,
  type TranspileResult,
} from "./transform/index.ts";
import type { TranspileOption } from "./transform/gts.ts";
import type { VolarMappingResult } from "./transform/volar/index.ts";
export { GtsTranspilerError } from "./error.ts";

export function transpile(
  source: string,
  filename: string,
  option: TranspileOption,
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
  option: TranspileOption,
): VolarMappingResult {
  const ast = parseLoose(source, {
    recordCallLParens: true,
  });
  return transformForVolar(ast, option, {
    content: source,
    filename,
  });
}

export type { TranspileOption, TranspileResult, VolarMappingResult };
export {
  resolveGtsConfig,
  resolveGtsConfigSync,
  type GtsConfig,
} from "./config.ts";
