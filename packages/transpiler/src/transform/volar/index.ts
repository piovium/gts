import type { AST } from "../../types";
import { walk } from "zimmerframe";
import type { SourceInfo, TranspileResult } from "..";
import { print } from "esrap";
import tsPrinter from "esrap/languages/ts";
import {
  initialTranspileState,
  type TranspileOption,
  type TranspileState,
} from "../gts";
import { gtsToTypingsWalker, type TypingTranspileState } from "./walker";
import { applyReplacements } from "./replacements";
import type { Program } from "estree";
import { convertToVolarMappings, type VolarMappingResult } from "./mappings";
import { collectLeafTokens, type LeafToken } from "./collect_tokens";

interface TypingTranspileOption extends TranspileOption {
  leafTokens: LeafToken[];
  // "row:col" -> "replacement string"
  additionalMappings: Map<string, string>;
}

function gtsToTypings(
  ast: AST.Program,
  option: TypingTranspileOption
): TranspileResult {
  const state: TypingTranspileState = {
    ...(initialTranspileState(option) as Pick<
      TypingTranspileState,
      keyof TranspileState
    >),
    leafTokens: option.leafTokens,
    idCounter: 0,
    typingPendingStatements: [],
    prefaceInserted: false,
    rootVmId: { type: "Identifier", name: "__root_vm" },
    replacementTag: { type: "Identifier", name: "__gts_replacement_tag" },
    symbolsId: {
      Meta: { type: "Identifier", name: "__gts_symbols_meta" },
      NamedDefinition: { type: "Identifier", name: "__gts_symbols_namedDef" },
    },
    defineLeadingComments: [],
    vmDefTypeIdStack: [],
    metaTypeIdStack: [],
    finalMetaTypeIdStack: [],
    attrsOfCurrentVm: [],
    additionalMappings: option.additionalMappings,
  };
  const newAst = walk(ast as AST.Node, state, gtsToTypingsWalker);
  const printer = tsPrinter({
    getLeadingComments: (node) => (node as AST.Node).leadingComments,
    getTrailingComments: (node) => (node as AST.Node).trailingComments,
  });
  const prevIdentifier = printer.Identifier!;
  printer.Identifier = function (node, context) {
    if (node.isDummy) {
      context.write("", node);
    } else {
      prevIdentifier(node, context);
    }
  };
  const { code, map } = print(newAst, printer, {
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
  sourceInfo: Required<SourceInfo>
): VolarMappingResult {
  const tokens = collectLeafTokens(ast);
  const additionalMappings = new Map<string, string>();
  const { code, sourceMap } = gtsToTypings(ast, {
    ...option,
    leafTokens: tokens,
    additionalMappings,
  });
  const volarMappings = convertToVolarMappings(
    code,
    sourceInfo.content,
    sourceMap,
    tokens,
    additionalMappings
  );
  return {
    code,
    mappings: volarMappings,
  };
}

export type { VolarMappingResult } from "./mappings";
