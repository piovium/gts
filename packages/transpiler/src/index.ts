import { parse, parseLoose } from "./parse";
import { transformForVolar } from "./transform";
import type { TranspileOption } from "./transform/gts";
import type { VolarMappingResult } from "./transform/gts_for_volar";

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
