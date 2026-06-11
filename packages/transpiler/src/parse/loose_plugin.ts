import { tokTypes, type Parser } from "acorn";
import type { AST, Parse } from "../types.js";

export const DUMMY_PLACEHOLDER = "✖";

export function loosePlugin() {
  return function loosePluginTransformer(parser: typeof Parser): typeof Parser {
    return class LooseParser extends (parser as typeof Parse.Parser) {
      private readonly _patchedParseIdent = (
        liberal?: boolean,
      ): AST.Identifier => {
        if (this.type.label === "name" || this.type.keyword) {
          return super.parseIdent(liberal);
        } else {
          return this.createDummyIdentifier();
        }
      };
      readonly #proxiedThis = new Proxy(this, {
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
        const dummy = this.startNodeAt(
          this.lastTokEnd,
          this.lastTokEndLoc,
        ) as AST.Identifier;
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
          this.#proxiedThis,
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
