import { tokTypes, type Parser as ParserClass } from "acorn";
import type { Parse, AST } from "../types";
import { specialIdentifiers } from "../keywords";
import { DUMMY_PLACEHOLDER } from "./loose_plugin";

/*

Statement:
+   DefineStatement

DefineStatement:
    "define" [no LineTerminator here] NamedAttributeDefinition

NamedAttributeDefinition:
    AttributeName AttributeBody AttributeBindingClause? ";"

AttributeName:
    Identifier
    StringLiteral

AttributeBody:
    PositionalAttributeList? NamedAttributeBlock? 

AttributeBindingClause:
    "as" BindingAccessModifier? Identifier

BindingAccessModifier:
    "private"
    "protected"
    "public"

PositionalAttributeList:
    AttributeExpression
    AttributeExpression "," PositionalAttributeList

NamedAttributeBlock:
    "{" NamedAttributeList DirectShortcutFunction "}"
    
NamedAttributeList:
    [empty]
    NamedAttributeDefinition NamedAttributeList

AttributeExpression:
    ":" ShortcutFunction
    # Intentionally disable object literal, for distinction to named attribute block
    # foo bar { baz = 1 };
    # foo bar, { baz: 1 };   // If allowed, hard to distinguish
    # foo bar, ({ baz: 1 }); // OK
    [lookahead != "{"] PrimaryExpression

DirectShortcutFunction:
    [lookahead = one of ":", ReservedWord]
    FunctionBody[~Yield, ~Await]

ShortcutFunction:
    # For simplicity, we consider : and subsequent left brace as two tokens
    "(" Expression[+In, ~Yield, ~Await] ")"
    "{" FunctionBody[~Yield, ~Await] "}"

PrimaryExpression:
    # Note: only allowed in ShortcutFunction
+   ShortcutArgumentExpression

ShortcutArgumentExpression:
    ":" Identifier

UnaryExpression:
+   query UnaryExpression
*/

export interface GtsPluginOption {
  allowEmptyShortcutMember?: boolean;
  allowEmptyPositionalAttribute?: boolean;
}

export function gtsPlugin(options: GtsPluginOption = {}) {
  return function gtsPluginTransformer(
    Parser: typeof ParserClass
  ): typeof ParserClass {
    const skipWhiteSpace = /(?:\s|\/\/.*|\/\*[^]*?\*\/)*/g;
    const lineBreak = /\r\n?|\n|\u2028|\u2029/;

    const acornScope = {
      SCOPE_TOP: 1,
      SCOPE_FUNCTION: 2,
      SCOPE_ASYNC: 4,
      SCOPE_GENERATOR: 8,
      SCOPE_ARROW: 16,
    };

    return class GtsParser extends (Parser as typeof Parse.Parser) {
      private readonly gtsOptions = options;
      private isShortcutContext = false;

      override parseStatement(
        context?: string | null,
        topLevel?: boolean,
        exports?: AST.ExportSpecifier
      ) {
        if (topLevel && this.gts_isDefineStatement()) {
          const node = this.startNode() as AST.GTSDefineStatement;
          this.next(); // consume 'define'
          node.body = this.gts_parseNamedAttributeDefinition();
          return this.finishNode(node, "GTSDefineStatement");
        }
        return super.parseStatement(context, topLevel, exports);
      }

      gts_isDefineStatement() {
        if (!this.isContextual("define")) {
          return false;
        }
        skipWhiteSpace.lastIndex = this.pos;
        const skip = skipWhiteSpace.exec(this.input)!;
        const next = this.pos + skip[0].length;
        return !lineBreak.test(this.input.slice(this.pos, next));
      }

      gts_parseNamedAttributeDefinition() {
        const node = this.startNode() as AST.GTSNamedAttributeDefinition;
        // AttributeName
        let name: any;
        if (this.type.label === "string") {
          name = this.parseExprAtom();
        } else if (this.type.label === "name") {
          name = this.parseIdent();
        } else {
          this.raise(this.start, "Expected attribute name");
        }
        node.name = name;
        // AttributeBody
        node.body = this.gts_parseAttributeBody();
        // AttributeBindingClause?
        if (this.eatContextual("as")) {
          if (this.eatContextual("public")) {
            node.bindingAccessModifier = "public";
          } else if (this.eatContextual("protected")) {
            node.bindingAccessModifier = "protected";
          } else if (this.eatContextual("private")) {
            node.bindingAccessModifier = "private";
          }
          node.bindingName = this.parseIdent();
        }
        // Expect semicolon
        this.semicolon();

        return this.finishNode(node, "GTSNamedAttributeDefinition");
      }

      gts_parseAttributeBody() {
        const node = this.startNode() as AST.GTSAttributeBody;
        // PositionalAttributeList?
        node.positionalAttributes = this.gts_parsePositionalAttributeList();
        // NamedAttributeBlock
        if (this.type === tokTypes.braceL) {
          node.namedAttributes = this.gts_parseNamedAttributeBlock();
        }
        return this.finishNode(node, "GTSAttributeBody");
      }

      gts_parsePositionalAttributeList() {
        // AttributeExpression* [lookahead = one of "{", "as", ";", eof]
        const node = this.startNode() as AST.GTSPositionalAttributeList;
        node.attributes = [];
        let first = true;
        while (true) {
          if (this.type === tokTypes.braceL) {
            break;
          }
          if (this.type === tokTypes.semi || this.canInsertSemicolon()) {
            break;
          }
          if (this.isContextual("as")) {
            break;
          }
          if (!first) {
            this.expect(tokTypes.comma);
          } else {
            first = false;
          }
          node.attributes.push(this.gts_parseAttributeExpression());
        }
        return this.finishNode(node, "GTSPositionalAttributeList");
      }

      gts_parseNamedAttributeBlock() {
        const node = this.startNode() as AST.GTSNamedAttributeBlock;
        node.attributes = [];
        this.expect(tokTypes.braceL);
        while (this.type !== tokTypes.braceR && this.type !== tokTypes.eof) {
          // Check for DirectShortcutFunction
          if (
            (specialIdentifiers as unknown[]).includes(this.value) ||
            this.type === tokTypes.colon
          ) {
            node.directAction = this.gts_parseDirectFunction();
            break;
          }
          node.attributes.push(this.gts_parseNamedAttributeDefinition());
        }
        this.expect(tokTypes.braceR);
        return this.finishNode(node, "GTSNamedAttributeBlock");
      }

      gts_parseDirectFunction() {
        const node = this.startNode() as AST.GTSDirectFunction;
        node.body = [];

        this.enterScope(acornScope.SCOPE_FUNCTION | acornScope.SCOPE_ARROW);
        const oldShortcutContext = this.isShortcutContext;
        this.isShortcutContext = true;
        while (this.type !== tokTypes.braceR && this.type !== tokTypes.eof) {
          const startPos = this.pos;
          const stmt = this.parseStatement(null);
          if (stmt.type === "GTSDefineStatement") {
            this.raise(
              startPos,
              "DefineStatement is not allowed in direct function."
            );
          }
          node.body.push(stmt);
        }
        this.exitScope();
        this.isShortcutContext = oldShortcutContext;

        return this.finishNode(node, "GTSDirectFunction");
      }

      gts_parseAttributeExpression() {
        // [lookahead != "{"] PrimaryExpression
        if (this.type === tokTypes.braceL) {
          this.raise(this.start, "Expected attribute expression, got '{'.");
        }
        if (this.type === tokTypes.colon) {
          this.next(); // consume ':'
          return this.gts_parseShortcutFunction();
        }
        if (
          this.gtsOptions.allowEmptyPositionalAttribute &&
          (this.type === tokTypes.comma ||
            this.type === tokTypes.braceR ||
            this.type === tokTypes.semi ||
            this.canInsertSemicolon() ||
            this.isContextual("as"))
        ) {
          // Allow omitting the attribute expression for language tooling
          const dummy = this.startNode() as AST.Identifier;
          dummy.name = DUMMY_PLACEHOLDER;
          dummy.isDummy = true;
          return this.finishNode(dummy, "Identifier");
        }
        return this.parseExprAtom();
      }

      gts_parseShortcutFunction() {
        const node = this.startNode() as AST.GTSShortcutFunctionExpression;
        this.enterScope(acornScope.SCOPE_FUNCTION | acornScope.SCOPE_ARROW);
        const oldShortcutContext = this.isShortcutContext;
        this.isShortcutContext = true;
        if (this.type === tokTypes.parenL) {
          this.next(); // consume '('
          node.expression = true;
          node.body = this.parseExpression();
          this.expect(tokTypes.parenR);
        } else if (this.type === tokTypes.braceL) {
          node.expression = false;
          node.body = this.parseBlock();
        }
        this.exitScope();
        this.isShortcutContext = oldShortcutContext;
        return this.finishNode(node, "GTSShortcutFunctionExpression");
      }

      override parseExprAtom(
        refDestructuringErrors?: Parse.DestructuringErrors,
        forInit?: boolean | "await",
        forNew?: boolean
      ): AST.Expression {
        if (this.type === tokTypes.colon) {
          if (!this.isShortcutContext) {
            this.raise(
              this.start,
              "ShortcutArgumentExpression ':' must be inside ShortcutFunction or DirectShortcutFunction."
            );
          }
          const node = this.startNode() as AST.GTSShortcutArgumentExpression;
          this.next(); // consume ':'
          if (
            this.gtsOptions.allowEmptyShortcutMember &&
            this.type !== tokTypes.name
          ) {
            // Allow omitting the identifier after ':' for language tooling
            const dummy = this.startNode() as AST.Identifier;
            dummy.name = DUMMY_PLACEHOLDER;
            dummy.isDummy = true;
            node.property = this.finishNode(dummy, "Identifier");
          } else {
            node.property = this.parseIdent();
          }

          return this.finishNode(node, "GTSShortcutArgumentExpression");
        }
        return super.parseExprAtom(refDestructuringErrors, forInit, forNew);
      }

      override parseMaybeUnary(
        refDestructuringErrors?: Parse.DestructuringErrors | null,
        sawUnary?: boolean,
        incDec?: boolean,
        forInit?: boolean | "await"
      ): AST.Expression {
        if (this.isContextual("query")) {
          const expr = this.gts_parseQueryExpression();
          if (!incDec && this.eat(tokTypes.starstar)) {
            this.unexpected(this.lastTokStart);
          }
          return expr;
        }
        return super.parseMaybeUnary(
          refDestructuringErrors,
          sawUnary,
          incDec,
          forInit
        );
      }

      gts_parseQueryExpression(
        forInit?: boolean | "await"
      ): AST.GTSQueryExpression {
        const node = this.startNode() as AST.GTSQueryExpression;
        this.next(); // consume 'query'
        if (this.eat(tokTypes.star)) {
          node.star = true;
        }
        node.argument = this.parseMaybeUnary(null, true, false, forInit);
        return this.finishNode(node, "GTSQueryExpression");
      }
    };
  };
}
