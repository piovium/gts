import type { Node, Program, SourceLocation } from "estree";
import { walk } from "zimmerframe";

export interface LeafToken {
  loc: SourceLocation;
  isDummy?: boolean;
  /**
   * Override source length (instead of loc.end - loc.start)
   */
  sourceLength?: number;
  /**
   * Adjust the start position of source code
   */
  sourceStartOffset?: number;
  /**
   * Adjust the start position of generated code
   */
  generatedStartOffset?: number;
  /**
   * Make the source length longer
   */
  sourceLengthOffset?: number;
  /**
   * The original length of generated code, used for mapping diagnostics
   */
  generatedLength?: number;
}

export function collectLeafTokens(source: string, ast: Program): LeafToken[] {
  interface CollectTokenState {
    tokens: LeafToken[];
    /** Whether the node is from source and purely TypeScript */
    pureSource: boolean;
    /** Whether the node is visited once (for detecting leaf node) */
    visited: boolean;
  }
  const state: CollectTokenState = {
    tokens: [],
    pureSource: true,
    visited: false,
  };
  walk(ast as Node, state, {
    _(node, { state, next }) {
      state.visited = true;
      let currNodePureSource = !!node.loc && !node.type.startsWith("GTS");
      const subState = { tokens: [], pureSource: true, visited: false };
      next(subState);
      currNodePureSource &&= subState.pureSource;
      state.pureSource &&= currNodePureSource;
      // record original source for purely branch node
      if (subState.visited && node.range && currNodePureSource) {
        const [start, end] = node.range;
        node.pureSource = source.slice(start, end);
      }
      if (currNodePureSource) {
        const token: LeafToken = {
          loc: node.loc!,
        };
        if ("isDummy" in node && node.isDummy) {
          token.isDummy = true;
          token.sourceLength = 0;
          // add 1 for squiggle on next character
          token.generatedLength = 1;
        }
        state.tokens.push(token);
      } else {
        state.tokens.push(...subState.tokens);
      }
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
