import type {
  ArrowFunctionExpression,
  Expression,
  ExpressionStatement,
  Literal,
  Node,
  ObjectExpression,
  Program,
} from "estree";
import { walk, type Visitors } from "zimmerframe";

interface TranspileState {
  readonly runtimeImportSource: string;
  readonly providerImportSource: string;
  readonly createDefineFnName: "__gts_createDefine";
  readonly binderFnName: "__gts_Binder";

  hasBinding: boolean;
}

const gtsVisitor: Visitors<Node, TranspileState> = {
  Program(node, { state, next }) {
    node = (next() as Program) ?? node;
    const body = [...node.body];
    if (state.hasBinding) {
      body.unshift({
        type: "ImportDeclaration",
        specifiers: [
          {
            type: "ImportDefaultSpecifier",
            local: { type: "Identifier", name: state.binderFnName },
          },
        ],
        source: {
          type: "Literal",
          value: `${state.providerImportSource}/binder`,
        },
        attributes: [],
      });
    }
    body.unshift({
      type: "ImportDeclaration",
      specifiers: [
        {
          type: "ImportSpecifier",
          imported: { type: "Identifier", name: "createDefine" },
          local: { type: "Identifier", name: state.createDefineFnName },
        },
      ],
      source: { type: "Literal", value: state.runtimeImportSource },
      attributes: [],
    });
    console.log(body);
    return {
      ...node,
      body,
    };
  },
  GTSDefineStatement(node, { state, visit }) {
    const body = visit(node.body) as Expression;
    const returnNode: ExpressionStatement = {
      type: "ExpressionStatement",
      expression: {
        type: "CallExpression",
        optional: false,
        callee: {
          type: "Identifier",
          name: state.createDefineFnName,
        },
        arguments: [body],
      },
    };
    return returnNode;
  },
  GTSNamedAttributeDefinition(node, { visit }) {
    const namedBody = visit(node.body) as ObjectExpression;
    const properties = [...namedBody.properties];
    const nameValue: Literal =
      node.name.type === "Literal"
        ? node.name
        : {
            ...node,
            type: "Literal",
            value: node.name.name,
          };
    properties.push({
      type: "Property",
      key: {
        type: "Identifier",
        name: "name",
      },
      computed: false,
      kind: "init",
      method: false,
      shorthand: false,
      value: nameValue,
    });
    const body = { ...namedBody, properties };
    const arrow: ArrowFunctionExpression = {
      type: "ArrowFunctionExpression",
      params: [],
      expression: true,
      body,
    };
    return arrow;
  },
  GTSAttributeBody(node) {
    // TODO
    const emptyBody: ObjectExpression = {
      type: "ObjectExpression",
      properties: [],
    };
    return emptyBody;
  },
  GTSPositionalAttributeList(node) {},
  GTSNamedAttributeBlock(node) {},
  GTSDirectFunction(node) {},
  GTSShortcutFunctionExpression(node) {},
  GTSShortcutArgumentExpression(node) {},
  GTSQueryExpression(node) {},
};

export const gtsToTs = (ast: Program): Program => {
  const state: TranspileState = {
    createDefineFnName: "__gts_createDefine",
    binderFnName: "__gts_Binder",
    
    runtimeImportSource: "@gi-tcg/gts-runtime",
    providerImportSource: "@gi-tcg/gts-provider",

    hasBinding: false,
  };
  return walk(ast, state, gtsVisitor) as Program;
};
