// https://github.com/sveltejs/svelte/blob/435da13fddaf1872a3fb46a7e8a20bb73322148e/packages/svelte/src/compiler/phases/1-parse/remove_typescript_nodes.js

import { type Context,type Visitors, walk } from "zimmerframe";
import type {
  FunctionExpression,
  FunctionDeclaration,
  Node,
  EmptyStatement,
} from "estree";
import { GtsTranspilerError } from "../error";

const empty: EmptyStatement = {
  type: "EmptyStatement",
};

function removeThisParameter(
  node: FunctionExpression | FunctionDeclaration,
  context: Context<any, any>,
) {
  if (node.params[0]?.type === "Identifier" && node.params[0].name === "this") {
    node.params.shift();
  }
  return context.next();
}

const throwInvalidFeature = (node: Node, feature: string) => {
  throw new GtsTranspilerError(
    `TypeScript feature not supported: ${feature}`,
    node.loc ?? null,
  );
};

const eraseTsVisitor: Visitors<any, null> = {
  _(node, context) {
    const n = context.next() ?? node;

    // there may come a time when we decide to preserve type annotations.
    // until that day comes, we just delete them so they don't confuse esrap
    delete n.typeAnnotation;
    delete n.typeParameters;
    delete n.typeArguments;
    delete n.returnType;
    delete n.accessibility;
    delete n.readonly;
    delete n.definite;
    delete n.override;
  },
  Decorator(node) {
    throwInvalidFeature(
      node,
      "decorators (related TSC proposal is not stage 4 yet)",
    );
  },
  ImportDeclaration(node) {
    if (node.importKind === "type") return empty;

    if (node.specifiers?.length > 0) {
      const specifiers = node.specifiers.filter(
        (s: any) => s.importKind !== "type",
      );
      if (specifiers.length === 0) return empty;

      return { ...node, specifiers };
    }

    return node;
  },
  ExportNamedDeclaration(node, context) {
    if (node.exportKind === "type") return empty;

    if (node.declaration) {
      const result = context.next();
      if (result?.declaration?.type === "EmptyStatement") {
        return empty;
      }
      return result;
    }

    if (node.specifiers) {
      const specifiers = node.specifiers.filter(
        (s: any) => s.exportKind !== "type",
      );
      if (specifiers.length === 0) return empty;

      return { ...node, specifiers };
    }

    return node;
  },
  ExportDefaultDeclaration(node) {
    if (node.exportKind === "type") return empty;
    return node;
  },
  ExportAllDeclaration(node) {
    if (node.exportKind === "type") return empty;
    return node;
  },
  PropertyDefinition(node, { next }) {
    if (node.accessor) {
      throwInvalidFeature(
        node,
        "accessor fields (related TSC proposal is not stage 4 yet)",
      );
    }
    return next();
  },
  TSAsExpression(node, context) {
    return context.visit(node.expression);
  },
  TSSatisfiesExpression(node, context) {
    return context.visit(node.expression);
  },
  TSNonNullExpression(node, context) {
    return context.visit(node.expression);
  },
  TSInterfaceDeclaration() {
    return empty;
  },
  TSTypeAliasDeclaration() {
    return empty;
  },
  TSTypeAssertion(node, context) {
    return context.visit(node.expression);
  },
  TSEnumDeclaration(node) {
    throwInvalidFeature(node, "enums");
  },
  TSParameterProperty(node, context) {
    if (
      (node.readonly || node.accessibility) &&
      context.path.at(-2)?.kind === "constructor"
    ) {
      throwInvalidFeature(
        node,
        "accessibility modifiers on constructor parameters",
      );
    }
    return context.visit(node.parameter);
  },
  TSInstantiationExpression(node, context) {
    return context.visit(node.expression);
  },
  FunctionExpression: removeThisParameter,
  FunctionDeclaration: removeThisParameter,
  TSDeclareFunction() {
    return empty;
  },
  ClassBody(node, context) {
    const body = [];
    for (const _child of node.body) {
      const child = context.visit(_child);
      if (child.type !== "PropertyDefinition" || !child.declare) {
        body.push(child);
      }
    }
    return {
      ...node,
      body,
    };
  },
  ClassDeclaration(node, context) {
    if (node.declare) {
      return empty;
    }
    delete node.abstract;
    delete node.implements;
    delete node.superTypeArguments;
    return context.next();
  },
  ClassExpression(node, context) {
    delete node.implements;
    delete node.superTypeArguments;
    return context.next();
  },
  MethodDefinition(node, context) {
    if (node.abstract) {
      return empty;
    }
    return context.next();
  },
  VariableDeclaration(node, context) {
    if (node.declare) {
      return empty;
    }
    return context.next();
  },
  TSModuleDeclaration(node, context) {
    if (!node.body) return empty;

    // namespaces can contain non-type nodes
    const cleaned = (node.body.body as any[]).map((entry) =>
      context.visit(entry),
    );
    if (cleaned.some((entry) => entry !== empty)) {
      throwInvalidFeature(node, "namespaces with non-type nodes");
    }

    return empty;
  },
};

export const eraseTs = <T>(ast: T): T => {
  return walk(ast, null, eraseTsVisitor);
}