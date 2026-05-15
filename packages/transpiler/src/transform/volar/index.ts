import type { AST } from "../../types.ts";
import { walk } from "zimmerframe";
import type { SourceInfo, TranspileResult } from "../index.ts";
import { print } from "esrap";
import {
  initialTranspileState,
  type TranspileOption,
  type TranspileState,
} from "../gts.ts";
import { gtsToTypingsWalker, type TypingTranspileState } from "./walker.ts";
import { applyReplacements } from "./replacements.ts";
import type { Program } from "estree";
import { convertToVolarMappings, type VolarMappingResult } from "./mappings.ts";
import { collectLeafTokens, type LeafToken } from "./collect_tokens.ts";
import { patchedPrinter } from "./printer.ts";

interface TypingTranspileOption extends TranspileOption {
  leafTokens: LeafToken[];
  /**
   * "row:col" -> "replacement string"
   */
  extraMappings: Map<string, string>;
}

function gtsToTypings(
  ast: AST.Program,
  option: TypingTranspileOption,
): TranspileResult {
  const state: TypingTranspileState = {
    ...(initialTranspileState(option) as Pick<
      TypingTranspileState,
      keyof TranspileState
    >),
    leafTokens: option.leafTokens,
    idCounter: 0,
    typingPendingStatements: [],
    rootVmId: { type: "Identifier", name: "__gts_root_vm" },
    utilNsId: { type: "Identifier", name: "__gts_util" },
    replacementTag: { type: "Identifier", name: "__gts_replacement_tag" },
    MetaLit: { type: "Literal", value: "~meta" },
    NamedDefinitionLit: { type: "Literal", value: "~namedDefinition" },
    defineLeadingComments: [],
    vmDefTypeIdStack: [],
    metaTypeIdStack: [],
    finalMetaTypeIdStack: [],
    attrsOfCurrentVm: [],
    extraMappings: option.extraMappings,
  };
  const newAst = walk(ast as AST.Node, state, gtsToTypingsWalker);
  const { code, map } = print(newAst, patchedPrinter, {
    indent: "  ",
  });
  return {
    code: applyReplacements(state, code),
    sourceMap: map,
  };
}

export function transformForVolar(
  ast: Program,
  option: TranspileOption,
  sourceInfo: Required<SourceInfo>,
): VolarMappingResult {
  const tokens = collectLeafTokens(ast);
  const extraMappings = new Map<string, string>();
  const { code, sourceMap } = gtsToTypings(ast, {
    ...option,
    leafTokens: tokens,
    extraMappings,
  });
  const volarMappings = convertToVolarMappings(
    code,
    sourceInfo.content,
    sourceMap,
    tokens,
    extraMappings,
  );
  return {
    code,
    mappings: volarMappings,
  };
}

export type { VolarMappingResult } from "./mappings.ts";
