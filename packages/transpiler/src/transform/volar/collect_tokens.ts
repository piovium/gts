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

export interface LocationAdjustment {
  /**
   * Adjust the start position of generated code
   */
  startOffset: number;
  /**
   * The original length of generated code, used for mapping diagnostics
   */
  generatedLength: number;
}

export interface LeafToken {
  loc: SourceLocation;
  isDummy?: boolean;
  sourceLength?: number;
  generatedLength?: number;
  locationAdjustment?: LocationAdjustment;
}

export function collectLeafTokens(ast: any): LeafToken[] {
  const tokens: LeafToken[] = [];
  walk(ast, tokens, {
    _(node, { state, next }) {
      if (isLeafNode(node) && node.loc) {
        const token: LeafToken = {
          loc: node.loc
        };
        if (node.isDummy) {
          token.isDummy = true;
          token.sourceLength = 0;
          token.generatedLength = 0;
        }
        state.push(token);
      }
      next();
    },
  });
  return tokens;
}
