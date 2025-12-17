import type {
  ArrowFunctionExpression,
  Declaration,
  ExportNamedDeclaration,
  Expression,
  ExpressionStatement,
  Identifier,
  Literal,
  Node,
  ObjectExpression,
  Program,
} from "estree";
import { walk, type Visitors } from "zimmerframe";

interface ExternalizedBinding {
  bindingName: Identifier;
  export: boolean;
  internalId: Identifier;
  value: Expression;
}

interface TranspileState {
  readonly runtimeImportSource: string;
  readonly providerImportSource: string;
  readonly createDefineFnId: Identifier;
  readonly binderFnId: Identifier;

  readonly externalizedBindings: ExternalizedBinding[];
}

const gtsVisitor: Visitors<Node, TranspileState> = {
  Program(node, { state, next }) {
    node = (next() as Program) ?? node;
    const body = [...node.body];
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
                    arguments: [binding.internalId],
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
          },
        ),
      );
    }
    body.unshift({
      type: "ImportDeclaration",
      specifiers: [
        {
          type: "ImportSpecifier",
          imported: { type: "Identifier", name: "createDefine" },
          local: state.createDefineFnId,
        },
      ],
      source: { type: "Literal", value: state.runtimeImportSource },
      attributes: [],
    });
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
        callee: state.createDefineFnId,
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
    createDefineFnId: { type: "Identifier", name: "__gts_createDefine" },
    binderFnId: { type: "Identifier", name: "__gts_Binder" },

    runtimeImportSource: "@gi-tcg/gts-runtime",
    providerImportSource: "@gi-tcg/gts-provider",

    externalizedBindings: [],
  };
  return walk(ast, state, gtsVisitor) as Program;
};
