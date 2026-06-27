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
  Pattern,
  Program,
  Statement,
} from "estree";
import { walk, type Visitors } from "zimmerframe";
import { GtsTranspilerError } from "../error.ts";
export interface ExternalizedBinding {
  bindingName: Identifier;
  export: boolean;
}

export interface TranspileState {
  readonly createDefineFnId: Identifier;
  readonly createBindingFnId: Identifier;
  readonly ActionLit: Literal;
  readonly fnArgId: Identifier;
  readonly rootVmId: Identifier;

  readonly runtimeImportSource: string;
  readonly providerImportSource: string;

  externalizedBindings: ExternalizedBinding[];
  /** Internal counters / state for emitting per-define nodes & bindings */
  defineIdCounter: number;

  /** Binding statements to be inserted before all define statement */
  bindingStatements: (Statement | ModuleDeclaration)[];
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
          value: state.ActionLit,
          loc: node.loc,
          range: node.range,
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
                  params: [state.fnArgId],
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
      range: node.range,
    };
  },
  GTSShortcutFunctionExpression(
    node,
    { visit, state }
  ): ArrowFunctionExpression {
    return {
      type: "ArrowFunctionExpression",
      params: [state.fnArgId],
      body: visit(node.body) as Expression | BlockStatement,
      expression: node.expression,
      loc: node.loc,
      range: node.range,
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
      range: node.range,
    };
  },
};

const gtsVisitor: Visitors<Node, TranspileState> = {
  Program(node, { state, visit }) {
    const body: Program["body"] = [];
    for (const stmt of node.body) {
      const visited = visit(stmt) as Statement;
      body.push(visited);
    }

    body.unshift(...state.bindingStatements);
    state.bindingStatements = [];

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

    state.bindingStatements.push({
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
      range: node.range,
    });

    state.bindingStatements.push({
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
      range: node.range,
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
        state.bindingStatements.push({
          type: "ExportNamedDeclaration",
          declaration: decl,
          specifiers: [],
          attributes: [],
        });
      } else {
        state.bindingStatements.push(decl);
      }
    }
    return {
      type: "ExpressionStatement",
      expression: {
        type: "CallExpression",
        optional: false,
        callee: state.createDefineFnId,
        arguments: [state.rootVmId, nodeVarId],
      },
      loc: node.loc,
      range: node.range,
    };
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
      range: node.range,
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
            range: positionals.range,
          },
          loc: positionals.loc,
          range: positionals.range,
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
          range: named.range,
        },
      ],
      loc: node.loc,
      range: node.range,
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
      range: node.range,
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
      range: node.range,
    };
  },
  ...commonGtsVisitor,
};

export interface TranspileOption {
  runtimeImportSource?: string;
  providerImportSource?: string;
}

export const initialTranspileState = (
  option: TranspileOption = {}
): TranspileState => {
  const fnArgId: Identifier = { type: "Identifier", name: "__gts_fnArg" };
  return {
    createDefineFnId: { type: "Identifier", name: "__gts_createDefine" },
    createBindingFnId: { type: "Identifier", name: "__gts_createBinding" },
    ActionLit: { type: "Literal", value: "~action" },
    fnArgId,
    rootVmId: { type: "Identifier", name: "__gts_rootVm" },

    runtimeImportSource: option.runtimeImportSource ?? "@gi-tcg/gts-runtime",
    providerImportSource: option.providerImportSource ?? "@gi-tcg/core/gts",

    externalizedBindings: [],
    defineIdCounter: 0,

    bindingStatements: [],
  };
};

export const gtsToTs = (
  ast: Program,
  option: TranspileOption = {}
): Program => {
  const state = initialTranspileState(option);
  return walk(ast, state, gtsVisitor) as Program;
};
