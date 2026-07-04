import type {
  Identifier,
  Literal,
  NewExpression,
  Node,
  SimpleCallExpression,
} from "estree";
import {
  type PrintOptions,
  type AST as EspolarAST,
  defaultPrinters,
  type SourceRange,
  type PrinterContext,
} from "espolar";
import type { CodeInformation } from "@volar/language-core";
import {
  ATTRIBUTE_NAME_MAPPING_DATA,
  DEFAULT_VOLAR_MAPPING_DATA,
  DIRECT_ACTION_STUB_MAPPING_DATA,
  LITERAL_FROM_ID_MAPPING_DATA,
  VERIFICATION_ONLY_MAPPING_DATA,
} from "./mappings.ts";
import type {
  TypingTranspileState,
  GTSAttributeNameHintStatement,
} from "./walker.ts";

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
      if ((node.type as string) === "ErrorStatement") {
        return false;
      }
      if (state.attributeNameNodes.has(node as Identifier | Literal)) {
        return false;
      }
      return state.sourceNodes.has(node as Node);
    },

    printCommentsOnUntouchedNodes: true,
    getLeadingComments: (node) => (node as Node).leadingComments,
    getTrailingComments: (node) => (node as Node).trailingComments,
    getMappingData: () => DEFAULT_VOLAR_MAPPING_DATA,
    // Add a 0-length mapping before and after each touched node with verification only,
    // so that error squiggles start/ends at those positions can be reflected.
    beforeWriteNode: ({ range, node, isUntouched, context }) => {
      if (isUntouched || !range || node.type === "ImportDeclaration") {
        // Don't do that for ImportDeclaration -- it mess up auto-import insertion point
        return;
      }
      context.writeMapped(
        "",
        range.start,
        range.start,
        VERIFICATION_ONLY_MAPPING_DATA,
      );
    },
    afterWriteNode: ({ range, node, isUntouched, context }) => {
      const [lastImportDecl, lastImportGenerated] =
        state.lastImportDeclaration ?? [];
      if (node.type === "ImportDeclaration" && lastImportDecl === node) {
        // If the last import declaration is a generated one, because of we ensured that
        // the generated import declarations are always unsorted, so TSServer will set the
        // auto-insertion point next to this last import declaration.
        // Add a mapping to that position (a written newline character) to the top-of-file,
        // after skipping hashbang and leading comments.
        context.write("\n");
        let sourceOffsetBaseBase = lastImportGenerated
          ? state.contentStartOffset
          : (node.range?.[1] ?? 0);
        const sourceOffset =
          sourceOffsetBaseBase +
          Math.max(0, context.source.slice(sourceOffsetBaseBase).search(/\n/));
        // These +1s below is magic and I don't know why, but it works.
        context.createExtraMapping(
          {
            start: sourceOffset + 1,
            end: sourceOffset + 1,
          },
          context.generatedOffset,
          context.generatedOffset,
          DEFAULT_VOLAR_MAPPING_DATA,
        );
      } else if (isUntouched || !range) {
        return;
      } else {
        context.writeMapped(
          "",
          range.end,
          range.end,
          VERIFICATION_ONLY_MAPPING_DATA,
        );
      }
    },
    printers: {
      // 1) Make the print of dummy identifier print nothing.
      //    Exception: if GTS attribute list's last argument is dummy, e.g.
      //        foo bar, ;
      //                ^~ here
      //    Then the printed JS will be `foo(bar, )` which WILL NOT be syntax error in ES6.
      //    So we mark the lastArg manually and print an additional comma
      //    for this dummy identifier, i.e. `foo(bar,,)` and TypeScript will recognize the error.
      // 2) Add mapping data "gtsAttribute" to GTS attribute name identifiers and literals.
      //    This will be recognized as "*.gtsAttribute" semantic token in language service plugin
      //    and remapped to "emphasis" in the language client that rendered as italic.
      Identifier(node, context) {
        const identifier = node as Identifier;
        if (identifier.isDummy && identifier.range) {
          const text = state.lastArgNodes.has(identifier) ? "," : "";
          // extend the source mapping of dummy id.
          let firstNonWhiteSpaceIndex = context.source
            .slice(identifier.range[1])
            .search(/\S/);
          if (firstNonWhiteSpaceIndex !== 0) {
            // a) if next char-seq is whitespaces, write them as mapped
            const rangeEnd =
              firstNonWhiteSpaceIndex === -1
                ? context.source.length
                : identifier.range[1] + firstNonWhiteSpaceIndex;
            context.writeMapped(text, identifier.range[0], rangeEnd);
          } else {
            // b) otherwise create extra mapping directly for next character
            const rangeEnd = Math.min(node.range[0] + 1, context.source.length);
            context.createExtraMapping(
              { start: identifier.range[0], end: rangeEnd },
              context.generatedOffset,
              context.generatedOffset + 1,
              DEFAULT_VOLAR_MAPPING_DATA,
            );
            context.write(text);
          }
        } else if (
          identifier.range &&
          state.attributeNameNodes.has(identifier)
        ) {
          context.writeMapped(
            identifier.name,
            identifier.range[0],
            identifier.range[1],
            ATTRIBUTE_NAME_MAPPING_DATA,
          );
        } else {
          defaultPrinters.Identifier(node, context);
        }
      },
      Literal(node, context) {
        const generatedStart = context.generatedOffset;
        let directActionStubRange: SourceRange | undefined;
        if (state.literalFromIdentifier.has(node) && node.range) {
          // For string literals generated from identifiers, add mappings from only the content of literal
          // to the identifier, so the highlight, auto-complete, etc. will work correctly.
          const text = JSON.stringify(node.value);
          context.write('"');
          context.writeMapped(
            text.slice(1, -1),
            node.range[0],
            node.range[1],
            LITERAL_FROM_ID_MAPPING_DATA,
          );
          context.write('"');
        } else if (state.attributeNameNodes.has(node) && node.range) {
          context.writeMapped(
            node.raw ?? JSON.stringify((node as EspolarAST.Literal).value),
            node.range[0],
            node.range[1],
            ATTRIBUTE_NAME_MAPPING_DATA,
          );
        } else if (
          (directActionStubRange = state.directActionStubRange.get(node))
        ) {
          // For direct action stubs, add mappings from this expression statement line to the
          // start of original direct action start position. Add `directActionStub` data
          // for recognizing them in language service plugin.
          context.writeMapped(
            node.raw ?? JSON.stringify((node as EspolarAST.Literal).value),
            directActionStubRange.start,
            directActionStubRange.start + 1,
            DIRECT_ACTION_STUB_MAPPING_DATA,
          );
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
      // @ts-expect-error This is a custom node type that don't have typing.
      // @see `GTSAttributeNameHintStatement`
      GTSAttributeNameHintStatement(
        node: GTSAttributeNameHintStatement,
        context: PrinterContext<CodeInformation>,
      ) {
        context.writeNode(node.object as EspolarAST.Node);
        context.write(".");
        context.writeSource(node.whiteSpaceStart, node.whiteSpaceEnd);
        context.write(";");
      },
      ErrorStatement(node: any, context: PrinterContext<CodeInformation>) {
        if (node.range) {
          context.writePreservedNode(node);
          const rangeEnd = Math.min(node.range[1] + 1, context.source.length);
          context.createExtraMapping(
            { start: node.range[1], end: rangeEnd },
            context.generatedOffset,
            context.generatedOffset + 1,
            VERIFICATION_ONLY_MAPPING_DATA,
          );
        } else {
          // Emit a TS error indicate the error. This should not happen.
          context.write(
            `((_: never) => 0)(${JSON.stringify(node.error ?? "Unknown error")});`,
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
