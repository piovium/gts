import { tokTypes, type Parser } from "acorn";
import type { AST, Parse } from "../types.ts";

/**
 * A plugin that records the location of the left parenthesis in CallExpression and
 * NewExpression.
 *
 * This is useful for Language tooling, that we can maps the '(' token from its location,
 * to provide a signature help for user when they press `(` after a function name.
 *
 * The recorded location will be stored in `lParenLoc` property of the
 * CallExpression/NewExpression node.
 * @returns the plugin function
 */
export function recordCallLParenPlugin() {
  return function recordCallLParenPluginTransformer(
    parser: typeof Parser,
  ): typeof Parser {
    return class RecordCallLParenParser extends (parser as typeof Parse.Parser) {
      override parseSubscript(
        base: AST.Expression,
        startPos: number,
        startLoc: AST.Position,
        noCalls?: boolean,
        maybeAsyncArrow?: boolean,
        optionalChained?: boolean,
        forInit?: boolean | "await",
      ): AST.Expression {
        let recordedLParenLoc: [number, number] | null = null;
        if (!noCalls && this.type === tokTypes.parenL) {
          recordedLParenLoc = [this.start, this.end];
        }
        const result = super.parseSubscript(
          base,
          startPos,
          startLoc,
          noCalls,
          maybeAsyncArrow,
          optionalChained,
          forInit,
        );
        if (recordedLParenLoc && result.type === "CallExpression") {
          result.lParenRange = recordedLParenLoc;
        }
        return result;
      }

      private _capturedLParenRangeFromNew: [number, number] | null = null;
      private readonly _patchedEat = (type: any) => {
        if (type === tokTypes.parenL) {
          this._capturedLParenRangeFromNew = [this.start, this.end];
        }
        return this.eat(type);
      };

      readonly #proxiedThis = new Proxy(this, {
        get: (target, prop) => {
          if (prop === "eat") {
            return this._patchedEat;
          }
          const value = Reflect.get(target, prop);
          if (typeof value === "function") {
            return value.bind(target);
          }
          return value;
        },
      });

      override parseNew() {
        const result = super.parseNew.apply(this.#proxiedThis);
        if (
          this._capturedLParenRangeFromNew &&
          result.type === "NewExpression"
        ) {
          result.lParenRange = this._capturedLParenRangeFromNew;
          this._capturedLParenRangeFromNew = null;
        }
        return result;
      }
    };
  };
}
