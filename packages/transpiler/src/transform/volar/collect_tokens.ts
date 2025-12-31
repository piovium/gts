import type { SourceLocation } from "estree";
import { walk } from "zimmerframe";

function isLeafNode(node: any): boolean {
  for (const key in node) {
    const val = node[key];

    // Ignore non-child properties (metadata)
    if (key === "loc" || key === "start" || key === "end" || key === "range") {
      continue;
    }

    // Check if the property is a Node
    // (An object with a 'type' property is generally an AST node)
    if (val && typeof val === "object" && typeof val.type === "string") {
      return false; // Found a valid child node
    }

    // Check if the property is an Array of Nodes (e.g., body: [...])
    if (
      Array.isArray(val) &&
      val.length > 0 &&
      typeof val[0].type === "string"
    ) {
      return false; // Found an array of child nodes
    }
  }
  return true;
}

export interface LeafToken {
  type: string;
  loc: SourceLocation;
}

export function collectLeafTokens(ast: any): LeafToken[] {
  const tokens: LeafToken[] = [];
  walk(ast, tokens, {
    _(node, { state, next }) {
      if (isLeafNode(node) && node.loc) {
        state.push({
          type: node.type,
          loc: node.loc,
        });
      }
      next();
    },
  });
  return tokens;
}
