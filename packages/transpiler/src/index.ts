import { parse, parseLoose } from "./parse";
import { transformForVolar } from "./transform";
import type { VolarMappingResult } from "./transform/gts_for_volar";

export function transpileForVolar(
  source: string,
  filename: string
): VolarMappingResult {
  const ast = parseLoose(source);
  return transformForVolar(
    ast,
    {},
    {
      content: source,
      filename,
    }
  );
}
