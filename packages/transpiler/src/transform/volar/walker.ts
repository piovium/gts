import type { Visitors } from "zimmerframe";
import type {
  ArrowFunctionExpression,
  Comment,
  EmptyStatement,
  ExportNamedDeclaration,
  Expression,
  ExpressionStatement,
  GTSDefineStatement,
  Identifier,
  ImportDeclaration,
  Literal,
  MemberExpression,
  Node,
  Program,
  SimpleLiteral,
  Statement,
  VariableDeclaration,
  VariableDeclarator,
} from "estree";
import {
  commonGtsVisitor,
  type ExternalizedBinding,
  type TranspileState,
} from "../gts.ts";
import { createReplacementHolder } from "./replacements.ts";
import type { SourceRange } from "espolar";

interface ExternalizedTypedBinding extends ExternalizedBinding {
  typingId: Identifier;
  leadingComments?: Comment[];
}

export interface TypingTranspileState extends TranspileState {
  externalizedBindings: ExternalizedTypedBinding[];
  idCounter: number;
  rootVmId: Identifier;
  utilNsId: Identifier;
  MetaLit: Literal;
  NamedDefinitionLit: Literal;
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
  /** Pending statements to be inserted to the top-level */
  typingPendingStatements: Statement[];
  replacementTag: Identifier;
  /** untouched source nodes */
  sourceNodes: WeakSet<Node>;
  /**
   * The callee of typing source of GTS' attribute names. Map the character
   * after the name (typically whitespace) as the lParen of CallExpression
   */
  namedAttributeCalleeLParenRange: WeakMap<Node, SourceRange>;
  /**
   * String literal nodes that are derived from identifiers.
   * - sourceStart += 1
   * - sourceLength -= 2
   */
  literalFromIdentifier: WeakSet<Literal>;
  /** Nodes that are last arguments of a CallExpression */
  lastArgNodes: WeakSet<Node>;
  /** Nodes that have a diagnostic mappings to the top of the file */
  diagnosticsOnTopNodes: WeakSet<Node>;
  /** Extra mappings, the generated range will be found by the needle after replacement */
  extraMappings: {
    sourceOffset: number;
    length: number;
    generatedNeedle: string;
  }[];
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

const enterVMFromRoot = (state: TypingTranspileState) => {
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
    }),
  );
  state.vmDefTypeIdStack.push(defTypeId);
  state.metaTypeIdStack.push(metaTypeId);
  state.finalMetaTypeIdStack.push(finalMetaTypeId);
  state.attrsOfCurrentVm.push([]);
};
const enterVMFromAttr = (
  state: TypingTranspileState,
  returningId: Identifier,
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
    }),
  );
  state.vmDefTypeIdStack.push(defTypeId);
  state.metaTypeIdStack.push(metaTypeId);
  state.finalMetaTypeIdStack.push(finalMetaTypeId);
  state.attrsOfCurrentVm.push([]);
};

const exitVM = (state: TypingTranspileState, errorRange?: [number, number]) => {
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
      errorRange,
    }),
  );
};

const enterAttr = (
  state: TypingTranspileState,
  attrName: string,
): { lhsId: Identifier } => {
  const defTypeId = state.vmDefTypeIdStack.at(-1);
  const metaTypeId = state.metaTypeIdStack.at(-1);
  if (!defTypeId || !metaTypeId) {
    // TODO error handling?
    return { lhsId: { type: "Identifier", name: "__gts_invalid_attr_obj" } };
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
      attrName,
    }),
  );
  return { lhsId: lhsId };
};

const genBindingTyping = (
  state: TypingTranspileState,
  info: {
    attrName: string;
    typingId: Identifier;
  },
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
    }),
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
    }),
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
    for (const extBinding of state.externalizedBindings) {
      const varDecl: VariableDeclaration = {
        type: "VariableDeclaration",
        kind: "const",
        declarations: [
          {
            type: "VariableDeclarator",
            id: extBinding.bindingName,
            init: ANY_INIT,
            typeAnnotation: {
              type: "TSTypeAnnotation",
              typeAnnotation: {
                type: "TSTypeReference",
                typeName: extBinding.typingId,
              },
            },
          } as VariableDeclarator,
        ],
      };
      if (extBinding.export) {
        body.unshift({
          type: "ExportNamedDeclaration",
          declaration: varDecl,
          specifiers: [],
          source: null,
          attributes: [],
          leadingComments: extBinding.leadingComments,
        } as ExportNamedDeclaration);
      } else {
        varDecl.leadingComments = extBinding.leadingComments;
        body.unshift(varDecl);
      }
    }
    const importDecls: ImportDeclaration[] = [];
    importDecls.push(
      {
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
      },
      {
        type: "ImportDeclaration",
        specifiers: [
          {
            type: "ImportSpecifier",
            imported: { type: "Identifier", name: "createDefine" },
            local: state.createDefineFnId,
          },
          {
            type: "ImportSpecifier",
            imported: { type: "Identifier", name: "createBinding" },
            local: state.createBindingFnId,
          },
        ],
        source: { type: "Literal", value: state.runtimeImportSource },
        attributes: [],
      },
    );
    for (const importDecl of importDecls) {
      state.diagnosticsOnTopNodes.add(importDecl.source);
      for (const specifier of importDecl.specifiers) {
        state.diagnosticsOnTopNodes.add(specifier);
      }
    }
    body.unshift(
      ...importDecls,
      createReplacementHolder(state, {
        type: "preface",
      }),
    );
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
      name.type === "Literal" ? String(name.value) : name.name,
    );
    const { lhsId } = enterAttr(state, attrName);
    const positionals = body.positionalAttributes.attributes.map(
      (attr): Expression => {
        if (attr.type === "Identifier" && /^[a-z_]/.test(attr.name)) {
          const lit: SimpleLiteral = {
            type: "Literal",
            value: attr.name,
            loc: attr.loc,
            range: attr.range,
          };
          state.literalFromIdentifier.add(lit);
          return lit;
        } else {
          return { ...(visit(attr) as Expression) };
        }
      },
    );
    const returnValue: Identifier = {
      type: "Identifier",
      name: `__gts_attrRet_${state.idCounter++}`,
    };
    const callee: MemberExpression = {
      type: "MemberExpression",
      object: lhsId,
      property: name,
      computed: name.type === "Literal",
      optional: false,
    };
    if (name.range) {
      // If the `obj.name` is not callable, the error squiggle begins from `obj` not `name`
      // Add a diagnostic-only mapping from the `name` to a call starting from `obj.`
      // This should be unique since each attribute decl generates a new obj name
      state.extraMappings.push({
        sourceOffset: name.range[0],
        length: name.range[1] - name.range[0],
        generatedNeedle: `${lhsId.name}${name.type === "Literal" ? `[` : `.`}`,
      });
      state.namedAttributeCalleeLParenRange.set(callee, {
        start: name.range[1],
        end: name.range[1] + 1,
      });
    }
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
            callee,
            arguments: positionals,
          },
        },
      ],
    });
    if (body.namedAttributes) {
      enterVMFromAttr(state, returnValue);
      visit(body.namedAttributes);
      exitVM(state, body.namedAttributes.range);
    }
    if (bindingName) {
      const export_ = node.bindingAccessModifier !== "private";
      const typingId: Identifier = {
        type: "Identifier",
        name: `__gts_binding_type_${state.externalizedBindings.length}`,
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
      const attrName = JSON.stringify(state.ActionLit.value);
      const { lhsId } = enterAttr(state, attrName);
      const actionNotExistsReplacementStr = `${lhsId.name}[${attrName}]`;
      if (node.directAction.range) {
        state.extraMappings.push({
          sourceOffset: node.directAction.range[0],
          length: node.directAction.range[1] - node.directAction.range[0],
          generatedNeedle: actionNotExistsReplacementStr,
        });
      }
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
                property: state.ActionLit,
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
