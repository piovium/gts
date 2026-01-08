import type {
  ArrayExpression,
  ArrowFunctionExpression,
  BlockStatement,
  Declaration,
  Expression,
  Identifier,
  Literal,
  MemberExpression,
  ModuleDeclaration,
  Node,
  ObjectExpression,
  ObjectPattern,
  Pattern,
  Program,
  Statement,
} from "estree";
import { walk, type Visitors } from "zimmerframe";
import { GtsTranspilerError } from "../error";
import {
  DEFAULT_QUERY_BINDINGS,
  DEFAULT_SHORTCUT_FUNCTION_PRELUDES,
} from "./constants";

export interface ExternalizedBinding {
  bindingName: Identifier;
  export: boolean;
}

export interface TranspileState {
  readonly createDefineFnId: Identifier;
  readonly createBindingFnId: Identifier;
  readonly ActionId: Identifier;
  readonly preludeSymbolId: Identifier;
  readonly fnArgId: Identifier;
  readonly shortcutFunctionParameters: Pattern[];
  readonly rootVmId: Identifier;
  readonly queryFnId: Identifier;
  readonly queryParameters: Pattern[];

  readonly runtimeImportSource: string;
  readonly providerImportSource: string;
  readonly queryArg: ObjectPattern;
  
  hasQueryExpressions: boolean;

  externalizedBindings: ExternalizedBinding[];
  /** Internal counters / state for emitting per-define nodes & bindings */
  defineIdCounter: number;

  /** Buffered statements to be inserted after visiting a define statement */
  pendingStatements: (Statement | ModuleDeclaration)[];
}

export const commonGtsVisitor: Visitors<Node, TranspileState> = {
  GTSDirectFunction(node, { visit, state }): ObjectExpression {
    return {
      type: "ObjectExpression",
      properties: [
        {
          type: "Property",
          key: { type: "Identifier", name: "name" },
          computed: false,
          kind: "init",
          method: false,
          shorthand: false,
          value: state.ActionId,
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
            type: "ArrowFunctionExpression",
            params: [],
            body: {
              type: "ArrayExpression",
              elements: [
                {
                  type: "ArrowFunctionExpression",
                  params: state.shortcutFunctionParameters,
                  body: {
                    type: "BlockStatement",
                    body: node.body.map((stmt) => visit(stmt) as Statement),
                  },
                  expression: false,
                },
              ],
            },
            expression: true,
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
      loc: node.loc,
    };
  },
  GTSShortcutFunctionExpression(
    node,
    { visit, state }
  ): ArrowFunctionExpression {
    return {
      type: "ArrowFunctionExpression",
      params: state.shortcutFunctionParameters,
      body: visit(node.body) as Expression | BlockStatement,
      expression: node.expression,
      loc: node.loc,
    };
  },
  GTSShortcutArgumentExpression(node, { state, visit }): MemberExpression {
    return {
      type: "MemberExpression",
      object: state.fnArgId,
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
          params: state.queryParameters,
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
      // loc: node.loc,
    };
  },
};

const gtsVisitor: Visitors<Node, TranspileState> = {
  // _(node, { next }) {
  //   console.log(node.type, !!node.leadingComments)
  //   if (node.leadingComments) {
  //     console.log(node.leadingComments);
  //   }
  //   return next();
  // },
  Program(node, { state, visit }) {
    const body: Program["body"] = [];
    for (const stmt of node.body) {
      const visited = visit(stmt) as Statement;
      // `GTSDefineStatement` is expanded into multiple statements via buffer
      if (visited.type !== "EmptyStatement") {
        body.push(visited);
      }
      if (state.pendingStatements.length > 0) {
        body.push(...(state.pendingStatements));
        state.pendingStatements = [];
      }
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
    body.unshift(
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
          {
            type: "ImportSpecifier",
            imported: { type: "Identifier", name: "Action" },
            local: state.ActionId,
          },
          {
            type: "ImportSpecifier",
            imported: { type: "Identifier", name: "Prelude" },
            local: state.preludeSymbolId,
          },
        ],
        source: { type: "Literal", value: state.runtimeImportSource },
        attributes: [],
      },
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
      }
    );
    return {
      ...node,
      body,
    };
  },
  GTSDefineStatement(node, { state, visit }): Statement {
    const defineId = state.defineIdCounter++;

    const rootAttr = visit(node.body) as Expression;

    const nodeVarId: Identifier = {
      type: "Identifier",
      name: `__gts_node_${defineId}`,
    };
    const bindingsVarId: Identifier = {
      type: "Identifier",
      name: `__gts_bindings_${defineId}`,
    };

    const newBindings = state.externalizedBindings;
    state.externalizedBindings = [];
    const statements: (Statement | ModuleDeclaration)[] = [];

    statements.push({
      type: "VariableDeclaration",
      kind: "const",
      declarations: [
        {
          type: "VariableDeclarator",
          id: nodeVarId,
          init: rootAttr,
        },
      ],
      loc: node.loc,
    });

    statements.push({
      type: "VariableDeclaration",
      kind: "const",
      declarations: [
        {
          type: "VariableDeclarator",
          id: bindingsVarId,
          init: {
            type: "CallExpression",
            optional: false,
            callee: state.createBindingFnId,
            arguments: [state.rootVmId, nodeVarId],
          },
        },
      ],
      loc: node.loc,
    });

    for (let i = 0; i < newBindings.length; i++) {
      const binding = newBindings[i];
      const decl: Declaration = {
        type: "VariableDeclaration",
        kind: "const",
        declarations: [
          {
            type: "VariableDeclarator",
            id: binding.bindingName,
            init: {
              type: "MemberExpression",
              object: bindingsVarId,
              property: { type: "Literal", value: i },
              computed: true,
              optional: false,
            },
          },
        ],
      };
      if (binding.export) {
        statements.push({
          type: "ExportNamedDeclaration",
          declaration: decl,
          specifiers: [],
          attributes: [],
        });
      } else {
        statements.push(decl);
      }
    }

    statements.push({
      type: "ExpressionStatement",
      expression: {
        type: "CallExpression",
        optional: false,
        callee: {
          ...state.createDefineFnId,
          loc: node.loc,
        },
        arguments: [state.rootVmId, nodeVarId],
      },
      loc: node.loc,
    });

    state.pendingStatements.push(...statements);
    return { type: "EmptyStatement" };
  },
  GTSNamedAttributeDefinition(node, { visit, state }) {
    const namedBody = visit(node.body) as ObjectExpression;
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
    if (node.bindingName) {
      if (node.bindingAccessModifier === "protected") {
        throw new GtsTranspilerError(
          "Protected bindings are not supported in this context.",
          node.loc ?? null
        );
      }
      const export_ = node.bindingAccessModifier !== "private";
      state.externalizedBindings.push({
        bindingName: node.bindingName,
        export: export_,
      });

      body.properties.push({
        type: "Property",
        key: { type: "Identifier", name: "binding" },
        computed: false,
        kind: "init",
        method: false,
        shorthand: false,
        value: {
          type: "Literal",
          value: export_ ? "public" : "private",
        },
      });
    }
    return body;
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
          value: {
            type: "ArrowFunctionExpression",
            params: [],
            body: positionals,
            expression: true,
            loc: positionals.loc,
          },
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
  ...commonGtsVisitor,
};

export interface TranspileOption {
  runtimeImportSource?: string;
  providerImportSource?: string;
  shortcutFunctionPreludes?: string[];
  queryBindings?: string[];
}

export const initialTranspileState = (
  option: TranspileOption = {}
): TranspileState => {
  const shortcutFunctionPreludes =
    option.shortcutFunctionPreludes ?? DEFAULT_SHORTCUT_FUNCTION_PRELUDES;
  const queryBindings = option.queryBindings ?? DEFAULT_QUERY_BINDINGS;
  const fnArgId: Identifier = { type: "Identifier", name: "__gts_fnArg" };
  const preludeSymbolId: Identifier = {
    type: "Identifier",
    name: "__gts_Prelude",
  };
  const shortcutFunctionParameters: Pattern[] = [
    fnArgId,
    {
      type: "AssignmentPattern",
      left: {
        type: "ObjectPattern",
        properties: shortcutFunctionPreludes.map((name) => ({
          type: "Property",
          computed: false,
          key: { type: "Identifier", name },
          value: { type: "Identifier", name },
          kind: "init",
          method: false,
          shorthand: true,
        })),
      },
      right: {
        type: "MemberExpression",
        object: fnArgId,
        property: preludeSymbolId,
        computed: true,
        optional: false,
      },
    },
  ];
  const queryParameters: Pattern[] = [
    {
      type: "ObjectPattern",
      properties: queryBindings.map((name) => ({
        type: "Property",
        computed: false,
        key: { type: "Identifier", name },
        value: { type: "Identifier", name },
        kind: "init",
        method: false,
        shorthand: true,
      })),
    },
  ];
  return {
    createDefineFnId: { type: "Identifier", name: "__gts_createDefine" },
    createBindingFnId: { type: "Identifier", name: "__gts_createBinding" },
    ActionId: { type: "Identifier", name: "__gts_Action" },
    preludeSymbolId,
    fnArgId,
    shortcutFunctionParameters,
    rootVmId: { type: "Identifier", name: "__gts_rootVm" },
    queryFnId: { type: "Identifier", name: "__gts_query" },
    queryParameters,

    runtimeImportSource: option.runtimeImportSource ?? "@gi-tcg/gts-runtime",
    providerImportSource: option.providerImportSource ?? "@gi-tcg/core/gts",
    queryArg: {
      type: "ObjectPattern",
      properties: (option.queryBindings ?? []).map((name) => ({
        type: "Property",
        key: { type: "Identifier", name },
        computed: false,
        kind: "init",
        method: false,
        shorthand: true,
        value: { type: "Identifier", name },
      })),
    },

    externalizedBindings: [],
    hasQueryExpressions: false,
    defineIdCounter: 0,

    pendingStatements: [],
  };
};

export const gtsToTs = (
  ast: Program,
  option: TranspileOption = {}
): Program => {
  const state = initialTranspileState(option);
  return walk(ast, state, gtsVisitor) as Program;
};
