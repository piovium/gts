import type { Visitors } from "zimmerframe";
import type {
  ArrayExpression,
  ArrowFunctionExpression,
  BlockStatement,
  Comment,
  Declaration,
  EmptyStatement,
  ExportNamedDeclaration,
  Expression,
  ExpressionStatement,
  GTSDefineStatement,
  Identifier,
  Literal,
  MemberExpression,
  Node,
  Program,
  SourceLocation,
  Statement,
  VariableDeclaration,
} from "estree";
import {
  commonGtsVisitor,
  type ExternalizedBinding,
  type TranspileState,
} from "../gts";
import type { LeafToken } from "./collect_tokens";
import { createReplacementHolder } from "./replacements";

interface ExternalizedTypedBinding extends ExternalizedBinding {
  typingId: Identifier;
  leadingComments?: Comment[];
}

export interface TypingTranspileState extends TranspileState {
  leafTokens: LeafToken[];
  externalizedBindings: ExternalizedTypedBinding[];
  idCounter: number;
  rootVmId: Identifier;
  symbolsId: {
    Meta: Identifier;
    NamedDefinition: Identifier;
  };
  defineLeadingComments: Comment[] | undefined;
  // type of current VM's definition
  vmDefTypeIdStack: Identifier[];
  // current collected Attribute names
  attrsOfCurrentVm: string[][];
  // type of current Meta
  metaTypeIdStack: Identifier[];
  // type of final Meta
  finalMetaTypeIdStack: Identifier[];
  // `obj` of `obj.attr(...)`
  // attrLhsIdStack: Identifier[];
  prefaceInserted: boolean;
  /** Pending statements to be inserted to the top-level */
  typingPendingStatements: Statement[];
  replacementTag: Identifier;
  additionalMappings: Map<string, string>;
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
    "Meta",
    "Action",
    "NamedDefinition",
    "Prelude",
  ] as const) {
    const init = {
      type: "TSTypeQuery",
      exprName: {
        type: "TSQualifiedName",
        left: symbolsLhs,
        right: { type: "Identifier", name: symbolName },
      },
    };
    const symbolId =
      symbolName === "Action"
        ? state.ActionId
        : symbolName === "Prelude"
        ? state.preludeSymbolId
        : state.symbolsId[symbolName];
    state.typingPendingStatements.push(
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
  state.typingPendingStatements.push(
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
  state.attrsOfCurrentVm.push([]);
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
  state.typingPendingStatements.push(
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
  state.attrsOfCurrentVm.push([]);
};

const exitVM = (state: TypingTranspileState, errorLoc?: string) => {
  const currentDefTypeId = state.vmDefTypeIdStack.pop()!;
  const currentMetaId = state.metaTypeIdStack.pop()!;
  const finalMetaId = state.finalMetaTypeIdStack.pop()!;
  const collectedAttrNames = state.attrsOfCurrentVm.pop()!;
  state.typingPendingStatements.push(
    createReplacementHolder(state, {
      type: "exitVM",
      metaType: currentMetaId.name,
      defType: currentDefTypeId.name,
      finalMetaType: finalMetaId.name,
      collectedAttrs: collectedAttrNames,
      errorLoc,
    })
  );
};

const enterAttr = (
  state: TypingTranspileState,
  attrName: string
): { lhsId: Identifier } => {
  const defTypeId = state.vmDefTypeIdStack.at(-1);
  const metaTypeId = state.metaTypeIdStack.at(-1);
  if (!defTypeId || !metaTypeId) {
    // TODO error handling?
    return { lhsId: { type: "Identifier", name: "__invalid_attr_obj" } };
  }
  state.attrsOfCurrentVm.at(-1)!.push(attrName);
  const lhsId: Identifier = {
    type: "Identifier",
    name: `__gts_attr_obj_${state.idCounter++}`,
  };
  state.typingPendingStatements.push(
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
  state.typingPendingStatements.push(
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
  state.typingPendingStatements.push(
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
        state.defineLeadingComments = stmt.leadingComments;
        visit(stmt);
        body.push(...state.typingPendingStatements);
        state.typingPendingStatements = [];
      } else {
        body.push(visit(stmt) as Statement);
      }
    }
    if (state.externalizedBindings.length > 0) {
      // TODO
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
          value: `${state.providerImportSource}/vm`,
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
    const attrName = JSON.stringify(
      name.type === "Literal" ? String(name.value) : name.name
    );
    const { lhsId } = enterAttr(state, attrName);
    const positionals = body.positionalAttributes.attributes.map(
      (attr): Expression => {
        if (attr.type === "Identifier" && /^[a-z_]/.test(attr.name)) {
          const token = state.leafTokens.find((t) => t.loc === attr.loc);
          if (token) {
            token.locationAdjustment = {
              startOffset: 1,
              generatedLength: attr.name.length + 2, // quotation mark
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
    state.typingPendingStatements.push({
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
      exitVM(
        state,
        `${body.namedAttributes.loc?.start.line}:${body.namedAttributes.loc?.start.column}`
      );
    }
    if (bindingName) {
      const export_ = node.bindingAccessModifier !== "private";
      const typingId: Identifier = {
        type: "Identifier",
        name: `gts_binding_type_${state.externalizedBindings.length}`,
      };
      genBindingTyping(state, {
        attrName,
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
        typingId,
        leadingComments: state.defineLeadingComments,
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
      const { lhsId } = enterAttr(state, state.ActionId.name);
      const fn: ArrowFunctionExpression = {
        type: "ArrowFunctionExpression",
        params: state.shortcutFunctionParameters,
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
      state.typingPendingStatements.push({
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
                property: state.ActionId,
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
    return {
      type: "MemberExpression",
      object: lhs,
      computed: false,
      optional: false,
      property: visit(node.property) as Identifier,
    };
  },
};
