import { tokTypes, type Parser } from "acorn";
import type { AST, Parse } from "../types.js";


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
        let recordedLParenLoc: AST.SourceLocation | null = null;
        if (!noCalls && this.type === tokTypes.parenL) {
          recordedLParenLoc = {
            start: this.startLoc,
            end: this.endLoc,
          };
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
          result.lParenLoc = recordedLParenLoc;
        }
        return result;
      }

      private _capturedLParenLocFromNew: AST.SourceLocation | null = null;
      private readonly _patchedEat = (type: any) => {
        if (type === tokTypes.parenL) {
          this._capturedLParenLocFromNew = {
            start: this.startLoc,
            end: this.endLoc,
          };
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
        if (this._capturedLParenLocFromNew && result.type === "NewExpression") {
          result.lParenLoc = this._capturedLParenLocFromNew;
          this._capturedLParenLocFromNew = null;
        }
        return result;
      }
    };
  };
}
