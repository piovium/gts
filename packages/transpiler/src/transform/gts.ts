import type {
  ArrayExpression,
  ArrowFunctionExpression,
  BlockStatement,
  CallExpression,
  Declaration,
  ExportNamedDeclaration,
  Expression,
  ExpressionStatement,
  Identifier,
  Literal,
  MemberExpression,
  Node,
  ObjectExpression,
  ObjectPattern,
  Program,
  Statement,
} from "estree";
import { walk, type Visitors } from "zimmerframe";
import { GtsTranspilerError } from "../error";

interface ExternalizedBinding {
  bindingName: Identifier;
  export: boolean;
  internalId: Identifier;
  value: Expression;
  path: string[];
}

interface TranspileState {
  readonly createDefineFnId: Identifier;
  readonly actionSymbolId: Identifier;
  readonly fnArgId: Identifier;
  readonly binderFnId: Identifier;
  readonly queryFnId: Identifier;

  readonly runtimeImportSource: string;
  readonly providerImportSource: string;
  readonly queryArg: ObjectPattern;

  readonly attributeNames: (Identifier | Literal)[];
  readonly externalizedBindings: ExternalizedBinding[];
  hasQueryExpressions: boolean;
}

const gtsVisitor: Visitors<Node, TranspileState> = {
  // _(node, { next }) {
  //   console.log(node.type, !!node.leadingComments)
  //   if (node.leadingComments) {
  //     console.log(node.leadingComments);
  //   }
  //   return next();
  // },
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
          },
        ),
      );
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
    body.unshift({
      type: "ImportDeclaration",
      specifiers: [
        {
          type: "ImportSpecifier",
          imported: { type: "Identifier", name: "createDefine" },
          local: state.createDefineFnId,
        },
        {
          type: "ImportSpecifier",
          imported: { type: "Identifier", name: "ActionSymbol" },
          local: state.actionSymbolId,
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
  GTSDefineStatement(node, { state, visit }): ExpressionStatement {
    const body = visit(node.body) as Expression;
    const wrapper: ObjectExpression = {
      type: "ObjectExpression",
      properties: [
        {
          type: "Property",
          key: { type: "Identifier", name: "attributes" },
          computed: false,
          kind: "init",
          method: false,
          shorthand: false,
          value: {
            type: "ArrayExpression",
            elements: [body],
          },
        },
      ],
    };
    return {
      type: "ExpressionStatement",
      expression: {
        type: "CallExpression",
        optional: false,
        callee: {
          ...state.createDefineFnId,
          loc: node.loc,
        },
        arguments: [wrapper],
      },
      loc: node.loc,
    };
  },
  GTSNamedAttributeDefinition(node, { visit, state }) {
    state.attributeNames.push(node.name);
    const namedBody = visit(node.body) as ObjectExpression;
    state.attributeNames.pop();
    const properties = [...namedBody.properties];
    const nameValue: Literal =
      node.name.type === "Literal"
        ? node.name
        : {
            ...node.name,
            type: "Literal",
            value: node.name.name,
          };
    properties.unshift({
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
      loc: node.loc,
    });
    const body = { ...namedBody, properties };
    const arrow: ArrowFunctionExpression = {
      type: "ArrowFunctionExpression",
      params: [],
      expression: true,
      body,
      loc: node.loc,
    };
    if (node.bindingName) {
      if (node.bindingAccessModifier === "protected") {
        throw new GtsTranspilerError(
          "Protected bindings are not supported in this context.",
          node.loc ?? null,
        );
      }
      const export_ = node.bindingAccessModifier !== "private";
      const internalId: Identifier = {
        type: "Identifier",
        name: `__gts_internal_binding_${state.externalizedBindings.length}`,
      };
      state.externalizedBindings.push({
        bindingName: node.bindingName,
        export: export_,
        internalId,
        value: arrow,
        path: [...state.attributeNames, node.name].map((n) => {
          if (n.type === "Literal") {
            return String(n.value);
          } else {
            return n.name;
          }
        }),
      });
      return internalId;
    } else {
      return arrow;
    }
  },
  GTSAttributeBody(node, { visit }) {
    const positionals = visit(node.positionalAttributes) as ArrayExpression;
    const named: Expression = node.namedAttributes
      ? (visit(node.namedAttributes) as ObjectExpression)
      : { type: "Literal", value: null };
    const partialBody: ObjectExpression = {
      type: "ObjectExpression",
      properties: [
        {
          type: "Property",
          key: { type: "Identifier", name: "positionals" },
          computed: false,
          kind: "init",
          method: false,
          shorthand: false,
          value: positionals,
          loc: positionals.loc,
        },
        {
          type: "Property",
          key: { type: "Identifier", name: "named" },
          computed: false,
          kind: "init",
          method: false,
          shorthand: false,
          value: named,
          loc: named.loc,
        },
      ],
      loc: node.loc,
    };
    return partialBody;
  },
  GTSPositionalAttributeList(node, { visit }): ArrayExpression {
    return {
      type: "ArrayExpression",
      elements: node.attributes.map((attr): Expression => {
        if (attr.type === "Identifier" && /^[a-z_]/.test(attr.name)) {
          return {
            ...attr,
            type: "Literal",
            value: attr.name,
          };
        } else {
          return visit(attr) as Expression;
        }
      }),
      loc: node.loc,
    };
  },
  GTSNamedAttributeBlock(node, { visit }): ObjectExpression {
    const attributes = node.attributes.map((node) => visit(node) as Expression);
    if (node.directAction) {
      attributes.push(visit(node.directAction) as Expression);
    }
    return {
      type: "ObjectExpression",
      properties: [
        {
          type: "Property",
          key: { type: "Identifier", name: "attributes" },
          computed: false,
          kind: "init",
          method: false,
          shorthand: false,
          value: {
            type: "ArrayExpression",
            elements: attributes,
          },
        },
      ],
      loc: node.loc,
    };
  },
  GTSDirectFunction(node, { visit, state }): ArrowFunctionExpression {
    return {
      type: "ArrowFunctionExpression",
      params: [],
      body: {
        type: "ObjectExpression",
        properties: [
          {
            type: "Property",
            key: { type: "Identifier", name: "name" },
            computed: false,
            kind: "init",
            method: false,
            shorthand: false,
            value: state.actionSymbolId,
            loc: node.loc,
          },
          {
            type: "Property",
            key: { type: "Identifier", name: "positionals" },
            computed: false,
            kind: "init",
            method: false,
            shorthand: false,
            value: {
              type: "ArrayExpression",
              elements: [
                {
                  type: "ArrowFunctionExpression",
                  params: [state.fnArgId],
                  body: {
                    type: "BlockStatement",
                    body: node.body.map((stmt) => visit(stmt) as Statement),
                  },
                  expression: false,
                },
              ],
            },
          },
          {
            type: "Property",
            key: { type: "Identifier", name: "named" },
            computed: false,
            kind: "init",
            method: false,
            shorthand: false,
            value: {
              type: "Literal",
              value: null,
            },
          },
        ],
      },
      expression: true,
      loc: node.loc,
    };
  },
  GTSShortcutFunctionExpression(
    node,
    { visit, state },
  ): ArrowFunctionExpression {
    return {
      type: "ArrowFunctionExpression",
      params: [state.fnArgId],
      body: visit(node.body) as Expression | BlockStatement,
      expression: node.expression,
      loc: node.loc,
    };
  },
  GTSShortcutArgumentExpression(node, { state, visit }): MemberExpression {
    return {
      type: "MemberExpression",
      object: {
        ...state.fnArgId,
        loc: node.loc,
      },
      computed: false,
      optional: false,
      property: visit(node.property) as Identifier,
      loc: node.loc,
    };
  },
  GTSQueryExpression(node, { state, visit }) {
    state.hasQueryExpressions = true;
    return {
      ...node,
      type: "CallExpression",
      optional: false,
      callee: state.queryFnId,
      arguments: [
        {
          type: "ArrowFunctionExpression",
          body: visit(node.argument) as Expression,
          params: [state.queryArg],
          expression: true,
          loc: node.argument.loc,
        },
        {
          type: "ObjectExpression",
          properties: [
            {
              type: "Property",
              key: { type: "Identifier", name: "star" },
              computed: false,
              kind: "init",
              method: false,
              shorthand: false,
              value: {
                type: "Literal",
                value: !!node.star,
              },
            },
          ],
        },
      ],
      loc: node.loc,
    };
  },
};

export const gtsToTs = (ast: Program): Program => {
  const queryExposeId: string[] = ["my", "opp"];

  const state: TranspileState = {
    createDefineFnId: { type: "Identifier", name: "__gts_createDefine" },
    actionSymbolId: { type: "Identifier", name: "__gts_ActionSymbol" },
    fnArgId: { type: "Identifier", name: "__gts_fnArg" },
    binderFnId: { type: "Identifier", name: "__gts_Binder" },
    queryFnId: { type: "Identifier", name: "__gts_query" },

    runtimeImportSource: "@gi-tcg/gts-runtime",
    providerImportSource: "@gi-tcg/gts-provider",
    queryArg: {
      type: "ObjectPattern",
      properties: queryExposeId.map((name) => ({
        type: "Property",
        key: { type: "Identifier", name },
        computed: false,
        kind: "init",
        method: false,
        shorthand: true,
        value: { type: "Identifier", name },
      })),
    },

    attributeNames: [],
    externalizedBindings: [],
    hasQueryExpressions: false,
  };
  return walk(ast, state, gtsVisitor) as Program;
};
