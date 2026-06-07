import type {
  Identifier,
  NewExpression,
  Node,
  SimpleCallExpression,
} from "estree";
import {
  type PrintOptions,
  type AST as EspolarAST,
  defaultPrinters,
} from "espolar";
import type { CodeInformation } from "@volar/language-core";
import {
  DEFAULT_VOLAR_MAPPING_DATA,
  VERIFICATION_ONLY_MAPPING_DATA,
} from "./mappings.ts";
import type { TypingTranspileState } from "./walker.ts";

export function getPrintOptions(
  source: string,
  state: TypingTranspileState,
): PrintOptions<CodeInformation> {
  return {
    source,
    isUntouched: (node) => {
      if (node.type === "Identifier" && (node as Identifier).isDummy) {
        return false;
      }
      return state.sourceNodes.has(node as Node);
    },
    getLeadingComments: (node) => (node as Node).leadingComments,
    getTrailingComments: (node) => (node as Node).trailingComments,
    getMappingData: () => DEFAULT_VOLAR_MAPPING_DATA,
    printers: {
      // Make the print of dummy identifier print nothing.
      // Exception: if GTS attribute list's last argument is dummy, e.g.
      //     foo bar, ;
      //             ^~ here
      // Then the printed JS will be `foo(bar, )` which WILL NOT be syntax error in ES6.
      // So we mark the lastArg manually and print an additional comma
      // for this dummy identifier, i.e. `foo(bar,,)` and TypeScript will recognize the error.
      Identifier(node, context) {
        const identifier = node as Identifier;
        if (identifier.isDummy && identifier.range) {
          const text = state.lastArgNodes.has(identifier) ? "," : "";
          // extend the source mapping of dummy id to the before next token
          let firstNonWhiteSpaceIndex = context.source
            .slice(identifier.range[1])
            .search(/\S/);
          const rangeEnd =
            firstNonWhiteSpaceIndex === -1
              ? context.source.length
              : identifier.range[1] + firstNonWhiteSpaceIndex;
          context.writeMapped(text, identifier.range[0], rangeEnd);
        } else {
          return defaultPrinters.Identifier(node, context);
        }
      },
      Literal(node, context) {
        const generatedStart = context.generatedOffset;
        if (state.literalFromIdentifier.has(node) && node.range) {
          const text = JSON.stringify(node.value);
          context.write('"');
          context.writeMapped(text.slice(1, -1), node.range[0], node.range[1]);
          context.write('"');
        } else {
          defaultPrinters.Literal(node, context);
        }
        // For generated `import xxx from "yyy"`, add mappings from xxx and yyy
        // to the top-of-file for diagnostics around missing / wrong imports. [[1]]
        if (state.diagnosticsOnTopNodes.has(node)) {
          const generatedEnd = context.generatedOffset;
          context.createExtraMapping(
            { start: 0, end: 1 },
            generatedStart,
            generatedEnd,
            VERIFICATION_ONLY_MAPPING_DATA,
          );
        }
      },
      // Same as [[1]]
      ImportDefaultSpecifier(node, context) {
        const generatedStart = context.generatedOffset;
        defaultPrinters.ImportDefaultSpecifier(node, context);
        if (state.diagnosticsOnTopNodes.has(node)) {
          const generatedEnd = context.generatedOffset;
          context.createExtraMapping(
            { start: 0, end: 1 },
            generatedStart,
            generatedEnd,
            VERIFICATION_ONLY_MAPPING_DATA,
          );
        }
      },
      // Same as [[1]]
      ImportSpecifier(node, context) {
        const generatedStart = context.generatedOffset;
        defaultPrinters.ImportSpecifier(node, context);
        if (state.diagnosticsOnTopNodes.has(node)) {
          const generatedEnd = context.generatedOffset;
          context.createExtraMapping(
            { start: 0, end: 1 },
            generatedStart,
            generatedEnd,
            VERIFICATION_ONLY_MAPPING_DATA,
          );
        }
      },
      // Maps the last generated import declaration
      ImportDeclaration(node, context) {
        defaultPrinters.ImportDeclaration(node, context);
        if (state.lastImportDeclarationIfGen === node) {
          context.createExtraMapping(
            // TODO: should be after hashbang and leading comments
            { start: 0, end: 1 },
            context.generatedOffset + 1,
            context.generatedOffset + 2,
            VERIFICATION_ONLY_MAPPING_DATA,
          );
        }
      },
    },
    // Enable triggering signature completion
    experimentalGetLeftParenSourceRange: (node) => {
      const callLike = node as SimpleCallExpression | NewExpression;
      if (callLike.lParenRange) {
        return {
          start: callLike.lParenRange[0],
          end: callLike.lParenRange[1],
        };
      }
      return state.namedAttributeCalleeLParenRange.get(callLike.callee);
    },
  };
}
