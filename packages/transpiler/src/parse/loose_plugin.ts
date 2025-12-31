import { tokTypes, type Parser } from "acorn";
import type { AST, Parse } from "../types.js";

export const DUMMY_PLACEHOLDER = '✖';

export function loosePlugin() {
  return function loosePluginTransformer(parser: typeof Parser): typeof Parser {
    return class LooseParser extends (parser as typeof Parse.Parser) {
      private readonly _patchedParseIdent = (
        liberal?: boolean,
      ): AST.Identifier => {
        if (this.type !== tokTypes.name) {
          return this.createDummyIdentifier();
        } else {
          return super.parseIdent(liberal);
        }
      };
      private _proxiedThis = new Proxy(this, {
        get: (target, prop) => {
          if (prop === "parseIdent") {
            return this._patchedParseIdent;
          }
          const value = Reflect.get(target, prop);
          if (typeof value === "function") {
            return value.bind(target);
          }
          return value;
        },
      });

      createDummyIdentifier() {
        const dummy = this.startNode() as AST.Identifier;
        dummy.name = DUMMY_PLACEHOLDER;
        dummy.isDummy = true;
        return this.finishNode(dummy, "Identifier");
      }

      override parseSubscript(
        base: AST.Expression,
        startPos: number,
        startLoc: AST.Position,
        noCalls?: boolean,
        maybeAsyncArrow?: boolean,
        optionalChained?: boolean,
        forInit?: boolean | "await",
      ): AST.Expression {
        return super.parseSubscript.call(
          this._proxiedThis,
          base,
          startPos,
          startLoc,
          noCalls,
          maybeAsyncArrow,
          optionalChained,
          forInit,
        );
      }
    };
  };
}
