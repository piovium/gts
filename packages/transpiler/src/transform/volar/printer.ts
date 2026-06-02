import type { AST } from "../../types.ts";
import type {
  Identifier,
  NewExpression,
  Node,
  SimpleCallExpression,
} from "estree";
import {
  type PrinterContext,
  type PrintOptions,
  type AST as EspolarAST,
  defaultPrinters,
} from "espolar";
import type { CodeInformation } from "@volar/language-core";
import { DEFAULT_VOLAR_MAPPING_DATA, VERIFICATION_ONLY_MAPPING_DATA } from "./mappings.ts";
import type { TypingTranspileState } from "./walker.ts";

export function getPrintOptions(
  source: string,
  state: TypingTranspileState,
): PrintOptions<CodeInformation> {
  return {
    source,
    isUntouched: (node) => {
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
          const text = state.lastArgNodes.has(node) ? "," : "";
          context.writeMapped(text, identifier.range[0], identifier.range[1]);
        } else {
          return defaultPrinters.Identifier(node, context);
        }
      },
      // For generated `import xxx from "yyy"`, add mappings from xxx and yyy
      // to the top-of-file for diagnostics around missing / wrong imports.
      Literal(node, context) {
        const generatedStart = context.generatedOffset;
        defaultPrinters.Literal(node, context);
        if (state.diagnosticsOnTopNodes.has(node as Node)) {
          const generatedEnd = context.generatedOffset;
          context.appendMapping(
            { start: 0, end: 1 },
            generatedStart,
            generatedEnd,
            VERIFICATION_ONLY_MAPPING_DATA,
          );
        }
      },
      ImportDefaultSpecifier(node, context) {
        const generatedStart = context.generatedOffset;
        defaultPrinters.ImportDefaultSpecifier(node, context);
        if (state.diagnosticsOnTopNodes.has(node as Node)) {
          const generatedEnd = context.generatedOffset;
          context.appendMapping(
            { start: 0, end: 1 },
            generatedStart,
            generatedEnd,
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
    },
  };
}
