import type { AST } from "../../types.ts";
import { walk } from "zimmerframe";
import type { SourceInfo, TranspileResult } from "../index.ts";
import { print } from "espolar";
import {
  initialTranspileState,
  type TranspileOption,
  type TranspileState,
} from "../gts.ts";
import { gtsToTypingsWalker, type TypingTranspileState } from "./walker.ts";
import { applyReplacements } from "./replacements.ts";
import type { Program } from "estree";
import {
  VERIFICATION_ONLY_MAPPING_DATA,
  type VolarMappingResult,
} from "./mappings.ts";
import { getPrintOptions } from "./printer.ts";

export function transformForVolar(
  ast: Program,
  option: TranspileOption,
  sourceInfo: Required<SourceInfo>,
): VolarMappingResult {
  const state: TypingTranspileState = {
    ...(initialTranspileState(option) as Pick<
      TypingTranspileState,
      keyof TranspileState
    >),
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

    sourceNodes: new WeakSet(),
    namedAttributeCalleeLParenRange: new WeakMap(),
    literalFromIdentifier: new WeakSet(),
    lastArgNodes: new WeakSet(),
    lastImportDeclarationIfGen: null,
    diagnosticsOnTopNodes: new WeakSet(),
    extraMappings: [],
  };
  // mark sourceNodes before the transformation
  walk(ast as AST.Node, state, {
    _(node, { state, next }) {
      if (node.range) {
        state.sourceNodes.add(node);
      }
      next();
    },
  });
  const newAst = walk(ast as AST.Node, state, gtsToTypingsWalker);
  // mark lastArgNodes
  walk(newAst as AST.Node, state, {
    CallExpression(node, { state }) {
      const lastArg = node.arguments.at(-1);
      if (lastArg) {
        state.lastArgNodes.add(lastArg);
      }
    },
    ImportDeclaration(node, { state }) {
      if (!state.sourceNodes.has(node)) {
        state.lastImportDeclarationIfGen = node;
      }
    },
  });
  const printOptions = getPrintOptions(sourceInfo.content, state);
  let { code, mappings } = print(newAst, printOptions);
  code = applyReplacements(state, code, mappings);
  for (const extraMapping of state.extraMappings) {
    const genOffset = code.indexOf(extraMapping.generatedNeedle);
    mappings.push({
      sourceOffsets: [extraMapping.sourceOffset],
      lengths: [extraMapping.length],
      generatedOffsets: [genOffset],
      generatedLengths: [extraMapping.generatedNeedle.length],
      data: VERIFICATION_ONLY_MAPPING_DATA,
    });
  }
  walk(newAst, null, {
    ImportDeclaration(node) {
      if (!node.range) {
        return;
      }
      const endOffset = node.range[1];
      const mappingEndsWithThisImport = mappings.find(
        (m) => m.sourceOffsets[0] + m.lengths[0] === endOffset,
      );
      if (mappingEndsWithThisImport?.lengths[0]) {
        mappingEndsWithThisImport.lengths[0] += 1; // include the newline after the import
      }
    },
  });
  return {
    code,
    mappings,
  };
}

export type { VolarMappingResult } from "./mappings.ts";
