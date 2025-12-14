import type { Node, Program } from "estree";
import { walk, type Visitors } from "zimmerframe";

interface TranspileState {}

const gtsVisitor: Visitors<Node, TranspileState> = {
  _(node, { next }) {
    if (node.type.startsWith("GTS")) {
      return { type: "EmptyStatement" }
    }
    next();
  },
  GTSDefineStatement(node) {

  },
  GTSNamedAttributeDefinition(node) {
  
  },
  GTSAttributeBody(node) {

  },
  GTSPositionalAttributeList(node) {

  },
  GTSNamedAttributeBlock(node) {
  
  },
  GTSDirectFunction(node) {

  },
  GTSShortcutFunctionExpression(node) {

  },
  GTSShortcutArgumentExpression(node) {

  },
  GTSQueryExpression(node) {

  },
};

export const gtsToTs = (ast: Program): Program => {
  return walk(ast, {}, gtsVisitor) as Program;
};
