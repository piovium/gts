import { decode } from "@jridgewell/sourcemap-codec";
import type {
  CodeInformation,
  CodeMapping,
  Mapping,
} from "@volar/language-core";
import type { AST } from "../../types";
import { walk, type Visitors } from "zimmerframe";
import type { SourceInfo, TranspileResult } from "..";
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
  MemberExpression,
  Node,
  Program,
  SourceLocation,
  Statement,
  VariableDeclaration,
} from "estree";
import {
  commonGtsVisitor,
  initialTranspileState,
  type ExternalizedBinding,
  type TranspileOption,
  type TranspileState,
} from "../gts";
import type { LeafToken } from "./collect_tokens";
import { createReplacementHolder } from "./replacements";

interface ExternalizedTypedBinding extends ExternalizedBinding {
  typingId: Identifier;
}

export interface TypingTranspileState extends TranspileState {
  leafTokens: LeafToken[];
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

export const gtsToTypingsWalker: Visitors<Node, TypingTranspileState> = {
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
          const token = state.leafTokens.find((t) => t.loc === attr.loc);
          if (token) {
            console.log("FOUND");
            token.locationAdjustment = {
              startOffset: 1,
            };
          }
          return {
            type: "Literal",
            value: attr.name,
            loc: attr.loc,
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
  GTSShortcutArgumentExpression(node, { state, visit }): MemberExpression {
    const lhs = { ...state.fnArgId };
    if (node.loc) {
      lhs.loc = {
        start: { ...node.loc.start },
        end: { ...node.loc.start },
      };
      state.leafTokens.push({
        type: lhs.type,
        loc: lhs.loc,
        locationAdjustment: {
          startOffset: lhs.name.length,
        },
      });
    }
    return {
      type: "MemberExpression",
      object: lhs,
      computed: false,
      optional: false,
      property: visit(node.property) as Identifier,
    };
  },
};
