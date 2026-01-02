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
    pendingStatements: [],
    prefaceInserted: false,
    rootVmId: { type: "Identifier", name: "__root_vm" },
    replacementTag: { type: "Identifier", name: "__gts_replacement_tag" },
    symbolsId: {
      MetaSymbol: { type: "Identifier", name: "__gts_symbols_meta" },
      ActionSymbol: { type: "Identifier", name: "__gts_symbols_action" },
      NamedDefinition: { type: "Identifier", name: "__gts_symbols_namedDef" },
    },
    vmDefTypeIdStack: [],
    metaTypeIdStack: [],
    finalMetaTypeIdStack: [],
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
  const { code, sourceMap } = gtsToTypings(ast, {
    ...option,
    leafTokens: tokens,
  });
  const volarMappings = convertToVolarMappings(
    code,
    sourceInfo.content,
    sourceMap,
    tokens
  );
  return {
    code,
    mappings: volarMappings,
  };
}

export type { VolarMappingResult } from "./mappings";
