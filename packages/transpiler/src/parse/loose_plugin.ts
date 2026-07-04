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
      readonly #proxiedThisTrapParseIdent = new Proxy(this, {
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
          this.#proxiedThisTrapParseIdent,
          base,
          startPos,
          startLoc,
          noCalls,
          maybeAsyncArrow,
          optionalChained,
          forInit,
        );
      }

      // Parsing block statements typically has:
      // ```js
      // while (this.type !== tokTypes.braceR) {
      //   this.parseStatement();
      // }
      // ```
      // But what happen if next token is EOF? since we tolerant error inside `parseStatement`,
      // so it fells into infinite loop. To avoid this, we use a proxy to trap the `this.type`
      // access and return a fake `braceR` when the current token is EOF.
      readonly #proxiedThisTrapEofToRbrace = new Proxy(this, {
        get: (target, prop) => {
          if (prop === "type" && target.type === tokTypes.eof) {
            return tokTypes.braceR;
          }
          const value = Reflect.get(target, prop);
          if (typeof value === "function") {
            return value.bind(target);
          }
          return value;
        },
      });

      override parseBlock(
        createNewLexicalScope?: boolean,
        node?: AST.BlockStatement,
        exitStrict?: boolean,
      ): AST.BlockStatement {
        return super.parseBlock.call(
          this.#proxiedThisTrapEofToRbrace,
          createNewLexicalScope,
          node,
          exitStrict,
        );
      }
      override parseClassStaticBlock(node: AST.Node): AST.StaticBlock {
        return super.parseClassStaticBlock.call(
          this.#proxiedThisTrapEofToRbrace,
          node,
        );
      }
      override parseSwitchStatement(node: AST.Node): AST.SwitchStatement {
        return super.parseSwitchStatement.call(
          this.#proxiedThisTrapEofToRbrace,
          node,
        );
      }

      override parseStatement(
        context?: string | null,
        topLevel?: boolean,
        exports?: AST.ExportSpecifier,
      ): AST.ExpressionStatement | AST.Statement | AST.GTSDefineStatement {
        const { start, startLoc, lastTokEnd, lastTokEndLoc } = this;
        if (topLevel && this.eat(tokTypes.braceR)) {
          const errorNode: any = this.startNodeAt(start, startLoc);
          errorNode.error = "Unexpected token }";
          return this.finishNode(errorNode, "ErrorStatement");
        }
        try {
          return super.parseStatement(context, topLevel, exports);
        } catch (e) {
          const errorNode: any = this.startNodeAt(lastTokEnd, lastTokEndLoc);
          errorNode.error = (e as Error)?.message;
          while (
            this.type !== tokTypes.eof &&
            this.type !== tokTypes.semi &&
            this.type !== tokTypes.braceR
          ) {
            this.next();
          }
          return this.finishNode(errorNode, "ErrorStatement");
        }
      }
    };
  };
}
