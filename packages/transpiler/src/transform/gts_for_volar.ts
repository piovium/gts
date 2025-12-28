import { decode } from "@jridgewell/sourcemap-codec";
import type {
  CodeInformation,
  CodeMapping,
  Mapping,
} from "@volar/language-core";
import type { AST } from "../types";
import { walk, type Visitors } from "zimmerframe";
import type { SourceInfo, TranspileResult } from ".";
import { print } from "esrap";
import tsPrinter from "esrap/languages/ts";
import type {
  ArrayExpression,
  ArrowFunctionExpression,
  BlockStatement,
  Declaration,
  EmptyStatement,
  ExportNamedDeclaration,
  Expression,
  ExpressionStatement,
  GTSDefineStatement,
  Identifier,
  Node,
  Program,
  Statement,
  VariableDeclaration,
} from "estree";
import {
  commonGtsVisitor,
  initialTranspileState,
  type ExternalizedBinding,
  type TranspileOption,
  type TranspileState,
} from "./gts";

export interface VolarMappingResult {
  code: string;
  mappings: CodeMapping[];
}

const DEFAULT_VOLAR_MAPPING_DATA: CodeInformation = {
  completion: true,
  format: true,
  navigation: true,
  semantic: true,
  structure: true,
  verification: true,
};

// Helper to create a line-to-offset lookup table
function createOffsetLookup(content: string): number[] {
  const lines = content.split("\n");
  const offsets: number[] = [];
  let currentOffset = 0;

  for (const line of lines) {
    offsets.push(currentOffset);
    // +1 for the newline character (handle \r\n vs \n if necessary)
    currentOffset += line.length + 1;
  }

  return offsets;
}

interface SourceMap {
  mappings: string;
}

interface ExternalizedTypedBinding extends ExternalizedBinding {
  typingId: Identifier;
}

export interface TypingTranspileState extends TranspileState {
  externalizedBindings: ExternalizedTypedBinding[];
  idCounter: number;
  rootVmId: Identifier;
  symbolsId: {
    MetaSymbol: Identifier;
    ActionSymbol: Identifier;
    NamedDefinition: Identifier;
  };
  // type of current VM's definition
  vmDefTypeIdStack: Identifier[];
  // type of current Meta
  metaTypeIdStack: Identifier[];
  // type of final Meta
  finalMetaTypeIdStack: Identifier[];
  // `obj` of `obj.attr(...)`
  // attrLhsIdStack: Identifier[];
  prefaceInserted: boolean;
  /** Pending statements to be inserted to the top-level */
  pendingStatements: Statement[];
  replacementTag: Identifier;
}

const EMPTY: EmptyStatement = { type: "EmptyStatement" };

const ANY = {
  type: "TSAnyKeyword",
};

// definite not supported by esrap yet, so we init the binding with an `as any` cast
// https://github.com/sveltejs/esrap/issues/95
const ANY_INIT = {
  type: "TSAsExpression",
  expression: { type: "Literal", value: 0 },
  typeAnnotation: ANY,
} as {} as Expression;

type ReplacementPayload =
  | {
      type: "enterVMFromRoot";
      vm: string;
      defType: string;
      metaType: string;
    }
  | {
      type: "enterVMFromAttr";
      returnType: string;
      defType: string;
      metaType: string;
    }
  | {
      type: "exitVM";
      metaType: string;
      finalMetaType: string;
    }
  | {
      type: "enterAttr";
      defType: string;
      metaType: string;
      lhs: string;
    }
  | {
      type: "createBindingTyping";
      finalMetaType: string;
      defType: string;
      attrName: string;
      typingId: string;
    }
  | {
      type: "exitAttr";
      returnType: string;
      defType: string;
      oldMetaType: string;
      newMetaType: string;
    };

const createReplacementHolder = (
  state: TypingTranspileState,
  value: ReplacementPayload
): ExpressionStatement => {
  const rawValue = JSON.stringify(value);
  return {
    type: "ExpressionStatement",
    expression: {
      type: "TaggedTemplateExpression",
      tag: state.replacementTag,
      quasi: {
        type: "TemplateLiteral",
        expressions: [],
        quasis: [
          {
            type: "TemplateElement",
            value: { raw: rawValue },
            tail: true,
          },
        ],
      },
    },
  };
};

const emitPreface = (state: TypingTranspileState) => {
  if (state.prefaceInserted) {
    return;
  }
  const symbolsLhs = {
    type: "TSQualifiedName",
    left: { type: "Identifier", name: state.rootVmId.name },
    right: { type: "Identifier", name: "_symbols" },
  };
  for (const symbolName of [
    "MetaSymbol",
    "ActionSymbol",
    "NamedDefinition",
  ] as const) {
    const init = {
      type: "TSTypeQuery",
      exprName: {
        type: "TSQualifiedName",
        left: symbolsLhs,
        right: { type: "Identifier", name: symbolName },
      },
    };
    const symbolId = state.symbolsId[symbolName];
    state.pendingStatements.push(
      {
        type: "TSTypeAliasDeclaration",
        id: symbolId,
        typeAnnotation: init,
      } as {} as VariableDeclaration,
      {
        type: "VariableDeclaration",
        kind: "const",
        declarations: [
          {
            type: "VariableDeclarator",
            id: {
              ...symbolId,
              typeAnnotation: {
                type: "TSTypeAnnotation",
                typeAnnotation: {
                  type: "TSTypeReference",
                  typeName: symbolId,
                },
              },
            } as Identifier,
            init: ANY_INIT,
          },
        ],
      } as VariableDeclaration
    );
  }
  state.prefaceInserted = true;
};

const enterVMFromRoot = (state: TypingTranspileState) => {
  emitPreface(state);
  let defTypeId: Identifier = {
    type: "Identifier",
    name: `__gts_rootVmDefType_${state.idCounter++}`,
  };
  let metaTypeId: Identifier = {
    type: "Identifier",
    name: `__gts_rootVmInitMetaType_${state.idCounter++}`,
  };
  let finalMetaTypeId: Identifier = {
    type: "Identifier",
    name: `__gts_rootVmFinalMetaType_${state.idCounter++}`,
  };
  state.pendingStatements.push(
    createReplacementHolder(state, {
      type: "enterVMFromRoot",
      vm: state.rootVmId.name,
      defType: defTypeId.name,
      metaType: metaTypeId.name,
    })
  );
  state.vmDefTypeIdStack.push(defTypeId);
  state.metaTypeIdStack.push(metaTypeId);
  state.finalMetaTypeIdStack.push(finalMetaTypeId);
};
const enterVMFromAttr = (
  state: TypingTranspileState,
  returningId: Identifier
) => {
  const defTypeId: Identifier = {
    type: "Identifier",
    name: `__gts_nestedVm_${state.idCounter++}`,
  };
  const metaTypeId: Identifier = {
    type: "Identifier",
    name: `__gts_nestedVmInitMetaType_${state.idCounter++}`,
  };
  const finalMetaTypeId: Identifier = {
    type: "Identifier",
    name: `__gts_nestedVmFinalMetaType_${state.idCounter++}`,
  };
  state.pendingStatements.push(
    createReplacementHolder(state, {
      type: "enterVMFromAttr",
      returnType: returningId.name,
      defType: defTypeId.name,
      metaType: metaTypeId.name,
    })
  );
  state.vmDefTypeIdStack.push(defTypeId);
  state.metaTypeIdStack.push(metaTypeId);
  state.finalMetaTypeIdStack.push(finalMetaTypeId);
};
const exitVM = (state: TypingTranspileState) => {
  state.vmDefTypeIdStack.pop();
  const currentMetaId = state.metaTypeIdStack.pop()!;
  const finalMetaId = state.finalMetaTypeIdStack.pop()!;
  state.pendingStatements.push(
    createReplacementHolder(state, {
      type: "exitVM",
      metaType: currentMetaId.name,
      finalMetaType: finalMetaId.name,
    })
  );
};

const enterAttr = (state: TypingTranspileState): { lhsId: Identifier } => {
  const defTypeId = state.vmDefTypeIdStack.at(-1);
  const metaTypeId = state.metaTypeIdStack.at(-1);
  if (!defTypeId || !metaTypeId) {
    // TODO error handling?
    return { lhsId: { type: "Identifier", name: "__invalid_attr_obj" } };
  }
  const lhsId: Identifier = {
    type: "Identifier",
    name: `__gts_attr_obj_${state.idCounter++}`,
  };
  state.pendingStatements.push(
    createReplacementHolder(state, {
      type: "enterAttr",
      defType: defTypeId.name,
      metaType: metaTypeId.name,
      lhs: lhsId.name,
    })
  );
  return { lhsId: lhsId };
};

const genBindingTyping = (
  state: TypingTranspileState,
  info: {
    attrName: string;
    typingId: Identifier;
  }
) => {
  const finalMetaId = state.finalMetaTypeIdStack.at(-1);
  const defTypeId = state.vmDefTypeIdStack.at(-1);
  if (!finalMetaId || !defTypeId) {
    return;
  }
  state.pendingStatements.push(
    createReplacementHolder(state, {
      type: "createBindingTyping",
      finalMetaType: finalMetaId.name,
      defType: defTypeId.name,
      attrName: info.attrName,
      typingId: info.typingId.name,
    })
  );
};

const exitAttr = (state: TypingTranspileState, returningId: Identifier) => {
  const currentDefId = state.vmDefTypeIdStack.at(-1);
  if (!currentDefId) {
    return;
  }
  const newMetaTypeId: Identifier = {
    type: "Identifier",
    name: `__gts_newMeta__${state.idCounter++}`,
  };
  const [oldMetaTypeId] = state.metaTypeIdStack.splice(-1, 1, newMetaTypeId);
  state.pendingStatements.push(
    createReplacementHolder(state, {
      type: "exitAttr",
      defType: currentDefId.name,
      oldMetaType: oldMetaTypeId.name,
      newMetaType: newMetaTypeId.name,
      returnType: returningId.name,
    })
  );
};

const gtsToTypingsWalker: Visitors<Node, TypingTranspileState> = {
  Program(node, { state, visit }) {
    const body: Program["body"] = [];
    for (const stmt of node.body) {
      if (
        (stmt as Statement | GTSDefineStatement).type === "GTSDefineStatement"
      ) {
        visit(stmt);
        body.push(...state.pendingStatements);
        state.pendingStatements = [];
      } else {
        body.push(visit(stmt) as Statement);
      }
    }
    if (state.externalizedBindings.length > 0) {
      body.unshift(
        {
          type: "ImportDeclaration",
          specifiers: [
            {
              type: "ImportDefaultSpecifier",
              local: state.binderFnId,
            },
          ],
          source: {
            type: "Literal",
            value: `${state.providerImportSource}/binder`,
          },
          attributes: [],
        },
        ...state.externalizedBindings.flatMap(
          (binding): (Declaration | ExportNamedDeclaration)[] => {
            const internalDecl: Declaration = {
              type: "VariableDeclaration",
              kind: "const",
              declarations: [
                {
                  type: "VariableDeclarator",
                  id: binding.internalId,
                  init: binding.value,
                },
              ],
            };
            const externalDecl: Declaration = {
              type: "VariableDeclaration",
              kind: "const",
              declarations: [
                {
                  type: "VariableDeclarator",
                  id: binding.bindingName,
                  init: {
                    type: "CallExpression",
                    optional: false,
                    callee: state.binderFnId,
                    arguments: [
                      binding.internalId,
                      {
                        type: "ObjectExpression",
                        properties: [
                          {
                            type: "Property",
                            key: { type: "Identifier", name: "path" },
                            computed: false,
                            kind: "init",
                            method: false,
                            shorthand: false,
                            value: {
                              type: "ArrayExpression",
                              elements: binding.path.map((segment) => ({
                                type: "Literal",
                                value: segment,
                              })),
                            },
                          },
                        ],
                      },
                    ],
                  },
                },
              ],
            };
            return binding.export
              ? [
                  internalDecl,
                  {
                    type: "ExportNamedDeclaration",
                    declaration: externalDecl,
                    specifiers: [],
                    attributes: [],
                  },
                ]
              : [internalDecl, externalDecl];
          }
        )
      );
    }
    if (state.prefaceInserted) {
      body.unshift({
        type: "ImportDeclaration",
        specifiers: [
          {
            type: "ImportDefaultSpecifier",
            local: state.rootVmId,
          },
        ],
        source: {
          type: "Literal",
          value: `${state.providerImportSource}/rootVM`,
        },
        attributes: [],
      });
    }
    if (state.hasQueryExpressions) {
      body.unshift({
        type: "ImportDeclaration",
        specifiers: [
          {
            type: "ImportDefaultSpecifier",
            local: state.queryFnId,
          },
        ],
        source: {
          type: "Literal",
          value: `${state.providerImportSource}/query`,
        },
        attributes: [],
      });
    }
    return {
      ...node,
      body,
    };
  },
  GTSDefineStatement(node, { state, visit }) {
    enterVMFromRoot(state);
    visit(node.body) as ExpressionStatement;
    exitVM(state);
    return EMPTY;
  },
  GTSNamedAttributeDefinition(node, { visit, state }) {
    const { name, body, bindingName } = node;
    const { lhsId } = enterAttr(state);
    const positionals = body.positionalAttributes.attributes.map(
      (attr): Expression => {
        if (attr.type === "Identifier" && /^[a-z_]/.test(attr.name)) {
          return {
            type: "Literal",
            value: attr.name,
            loc: attr.loc
              ? {
                  start: {
                    column: attr.loc.start.column - 1,
                    line: attr.loc.start.line,
                  },
                  end: {
                    column: attr.loc.end.column + 1,
                    line: attr.loc.end.line,
                  },
                }
              : void 0,
          };
        } else {
          return visit(attr) as Expression;
        }
      }
    );
    const returnValue: Identifier = {
      type: "Identifier",
      name: `__gts_attrRet_${state.idCounter++}`,
    };
    state.pendingStatements.push({
      type: "VariableDeclaration",
      kind: "const",
      declarations: [
        {
          type: "VariableDeclarator",
          id: returnValue,
          init: {
            type: "CallExpression",
            optional: false,
            callee: {
              type: "MemberExpression",
              object: lhsId,
              property: name,
              computed: name.type === "Literal",
              optional: false,
            },
            arguments: positionals,
          },
        },
      ],
    });
    if (body.namedAttributes) {
      enterVMFromAttr(state, returnValue);
      visit(body.namedAttributes);
      exitVM(state);
    }
    if (bindingName) {
      const export_ = node.bindingAccessModifier !== "private";
      const internalId: Identifier = {
        type: "Identifier",
        name: `__gts_internal_binding_${state.externalizedBindings.length}`,
      };
      const typingId: Identifier = {
        type: "Identifier",
        name: `gts_binding_type_${state.externalizedBindings.length}`,
      };
      genBindingTyping(state, {
        attrName: JSON.stringify(
          name.type === "Literal" ? String(name.value) : name.name
        ),
        typingId,
      });
      state.externalizedBindings.push({
        bindingName: {
          ...bindingName,
          typeAnnotation: {
            type: "TSTypeAnnotation",
            typeAnnotation: {
              type: "TSTypeReference",
              typeName: typingId,
            },
          },
        } as Identifier,
        export: export_,
        internalId,
        value: { type: "Literal", value: null }, // TODO
        path: [...state.attributeNames, node.name].map((n) => {
          if (n.type === "Literal") {
            return String(n.value);
          } else {
            return n.name;
          }
        }),
        typingId,
      });
    }
    exitAttr(state, returnValue);
    return EMPTY;
  },
  GTSNamedAttributeBlock(node, { state, visit }) {
    for (const attr of node.attributes) {
      visit(attr);
    }
    if (node.directAction) {
      const { lhsId } = enterAttr(state);
      const fn: ArrowFunctionExpression = {
        type: "ArrowFunctionExpression",
        params: [state.fnArgId],
        body: {
          type: "BlockStatement",
          body: node.directAction.body.map((stmt) => visit(stmt) as Statement),
        },
        expression: false,
      };
      const returnValue: Identifier = {
        type: "Identifier",
        name: `__gts_attrRet_${state.idCounter++}`,
      };
      state.pendingStatements.push({
        type: "VariableDeclaration",
        kind: "const",
        declarations: [
          {
            type: "VariableDeclarator",
            id: returnValue,
            init: {
              type: "CallExpression",
              optional: false,
              callee: {
                type: "MemberExpression",
                object: lhsId,
                property: state.symbolsId.ActionSymbol,
                computed: true,
                optional: false,
              },
              arguments: [fn],
            },
          },
        ],
      });
    }
    return EMPTY;
  },
  ...(commonGtsVisitor as Visitors<Node, TypingTranspileState>),
};

export function gtsToTypings(
  ast: AST.Program,
  option: TranspileOption
): TranspileResult {
  const state: TypingTranspileState = {
    ...(initialTranspileState(option) as Pick<
      TypingTranspileState,
      keyof TranspileState
    >),
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
  const { code, map } = print(
    newAst,
    tsPrinter({
      getLeadingComments: (node) => (node as AST.Node).leadingComments,
      getTrailingComments: (node) => (node as AST.Node).trailingComments,
    }),
    {
      indent: "  ",
    }
  );
  return {
    code: applyReplacements(state, code),
    sourceMap: map,
  };
}

function applyReplacements(state: TypingTranspileState, code: string) {
  const replacementRegex = new RegExp(
    "\\b" + state.replacementTag.name + "`(.*?)`",
    "gm"
  );
  const {
    symbolsId: { NamedDefinition, MetaSymbol },
  } = state;
  return code.replace(replacementRegex, (_, rawPayload) => {
    const payload: ReplacementPayload = JSON.parse(rawPayload);
    if (payload.type === "enterVMFromRoot") {
      return `type ${payload.defType} = (typeof ${payload.vm})[${NamedDefinition.name}]; type ${payload.metaType} = ${payload.defType}[${MetaSymbol.name}];`;
    } else if (payload.type === "enterVMFromAttr") {
      return `type ${payload.defType} = ${payload.returnType} extends { namedDefinition: infer Def } ? Def : { [${MetaSymbol.name}]: unknown }; type ${payload.metaType} = ${payload.defType}[${MetaSymbol.name}];`;
    } else if (payload.type === "exitVM") {
      return `type ${payload.finalMetaType} = ${payload.metaType};`;
    } else if (payload.type === "enterAttr") {
      return `const ${payload.lhs}: { [${MetaSymbol.name}]: ${payload.metaType} } & Omit<${payload.defType}, ${MetaSymbol.name}> = 0 as any;`;
    } else if (payload.type === "createBindingTyping") {
      const typingIdLhs = `${payload.typingId}_lhs`;
      return `type ${typingIdLhs} = { [${MetaSymbol.name}]: ${payload.finalMetaType}; as: ${payload.defType}[${payload.attrName}] extends { as: infer As } ? As : unknown }; let ${typingIdLhs}!: ${typingIdLhs}; let ${payload.typingId} = ${typingIdLhs}.as(); type ${payload.typingId} = typeof ${payload.typingId};`;
    } else if (payload.type === "exitAttr") {
      return `type ${payload.returnType} = typeof ${payload.returnType}; type ${payload.newMetaType} = ${payload.returnType} extends { rewriteMeta: infer NewMeta extends {} } ? NewMeta : ${payload.oldMetaType}`;
    } else {
      return "";
    }
  });
}

export function convertToVolarMappings(
  code: string,
  source: string,
  sourceMap: SourceMap
): CodeMapping[] {
  const decodedLines = decode(sourceMap.mappings);
  const volarMappings: CodeMapping[] = [];

  // 1. Prepare offset lookups
  const generatedLineOffsets = createOffsetLookup(code);
  const sourceLineOffsets = createOffsetLookup(source);

  // 2. Iterate over the decoded standard mappings
  decodedLines.forEach((segments, genLineIndex) => {
    const genLineStartOffset = generatedLineOffsets[genLineIndex];

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      const nextSegment = segments[i + 1];

      // Standard map segment: [genCol, sourceIndex, sourceLine, sourceCol, nameIndex]
      // We only care about mapped segments (length 4 or 5)
      if (segment.length === 4 || segment.length === 5) {
        const [genCol, sourceIndex, sourceLine, sourceCol] = segment;

        const generatedOffset = genLineStartOffset + genCol;
        const sourceOffset = sourceLineOffsets[sourceLine] + sourceCol;

        // Calculate Length
        // Standard maps are points, Volar maps are ranges.
        // We infer length by looking at the next segment's start or end of line.
        let length = 0;
        if (nextSegment) {
          length = nextSegment[0] - genCol;
        } else {
          return;
          // If it's the last segment in the line, length goes to end of line
          // (You might need logic here to exclude newline chars depending on exact needs)
          const lineLength =
            (generatedLineOffsets[genLineIndex + 1] || code.length + 1) -
            1 -
            genLineStartOffset;
          length = lineLength - genCol;
        }

        // 3. Construct the Volar Mapping
        volarMappings.push({
          sourceOffsets: [sourceOffset],
          generatedOffsets: [generatedOffset],
          lengths: [length],
          data: DEFAULT_VOLAR_MAPPING_DATA, // Populate with specific data if your tooling needs semantic info
        });
      }
    }
  });

  return volarMappings;
}
