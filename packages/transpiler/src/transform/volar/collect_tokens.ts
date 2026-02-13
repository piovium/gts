import type { Node, SourceLocation } from "estree";
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
  loc: SourceLocation;
  isDummy?: boolean;
  /**
   * Override source length (instead of loc.end - loc.start)
   */
  sourceLength?: number;
  /**
   * Adjust the start position of generated code
   */
  startOffset?: number;
  /**
   * Make the source length longer
   */
  sourceLengthOffset?: number;
  /**
   * The original length of generated code, used for mapping diagnostics
   */
  generatedLength?: number;
}

export function collectLeafTokens(ast: any): LeafToken[] {
  const state = {
    tokens: [] as LeafToken[],
  };
  walk(ast as Node, state, {
    _(node, { state, next }) {
      if (isLeafNode(node) && node.loc) {
        const token: LeafToken = {
          loc: node.loc,
        };
        if ("isDummy" in node && node.isDummy) {
          token.isDummy = true;
          token.sourceLength = 0;
          // add 1 for squiggle on next character
          token.generatedLength = 1;
        }
        state.tokens.push(token);
      }
      next();
    },
    NewExpression(node, { state, next }) {
      const lParenLoc = node.lParenLoc;
      if (lParenLoc) {
        state.tokens.push({
          loc: lParenLoc,
        });
      }
      next();
    },
    CallExpression(node, { state, next }) {
      const lParenLoc = node.lParenLoc;
      if (lParenLoc) {
        state.tokens.push({
          loc: lParenLoc,
        });
      }
      next();
    },
  });
  return state.tokens;
}
