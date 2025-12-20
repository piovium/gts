import { parse } from "./parse";
import { transformForVolar } from "./transform";
import type { VolarMappingResult } from "./transform/gts_for_volar";

export function transpileForVolar(
  source: string,
  filename: string
): VolarMappingResult {
  const ast = parse(source);
  return transformForVolar(
    ast,
    {},
    {
      content: source,
      filename,
    }
  );
}
