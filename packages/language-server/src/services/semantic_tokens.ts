import {
  type LanguageServicePlugin,
  type LanguageServicePluginInstance,
  type SemanticToken,
} from "@volar/language-server";
import { getVirtualCode } from "../utils.ts";

export const createSemanticTokensPlugin = (): LanguageServicePlugin => {
  return {
    name: "gts-semantic-tokens",
    capabilities: {
      semanticTokensProvider: {
        legend: {
          tokenTypes: ["string"],
          tokenModifiers: ["gtsAttribute"],
        },
      },
    },
    create: (context) => {
      let tsSemanticTokens: LanguageServicePluginInstance["provideDocumentSemanticTokens"];

      for (const [plugin, instance] of context.plugins) {
        if (
          plugin.name === "typescript-semantic" &&
          instance.provideDocumentSemanticTokens
        ) {
          let originalProvideDocumentSemanticTokens =
            instance.provideDocumentSemanticTokens;
          tsSemanticTokens = instance.provideDocumentSemanticTokens = async (
            document,
            range,
            legend,
            token,
          ) => {
            const response = await originalProvideDocumentSemanticTokens.call(
              instance,
              document,
              range,
              legend,
              token,
            );
            if (!response) {
              return response;
            }
            const gtsAttributeIndex =
              legend.tokenModifiers.indexOf("gtsAttribute");
            if (gtsAttributeIndex === -1) {
              return response;
            }
            const [virtualCode] = getVirtualCode(document, context);
            if (!virtualCode) {
              return response;
            }
            for (let i = 0; i < response.length; i++) {
              const [line, character, length, tokenType, tokenModifiers] =
                response[i];
              if (tokenType !== legend.tokenTypes.indexOf("method")) {
                continue;
              }
              const offset = document.offsetAt({ line, character });
              const mapping = virtualCode.mappings.find(
                (m) => m.generatedOffsets[0] === offset && m.data.gtsAttribute,
              );
              if (mapping) {
                response[i][4] |= 1 << gtsAttributeIndex;
              }
            }
            return response;
          };
        }
      }
      if (!tsSemanticTokens) {
        console.warn(`TS's original provideDocumentSemanticTokens not found`);
      }
      return {
        // Attribute value that is a string literal but no wrapping quotation with it,
        // add a semantic token of type "string" to them so they show same color as string literal
        provideDocumentSemanticTokens(document, range, legend, token) {
          const [virtualCode] = getVirtualCode(document, context);
          if (!virtualCode) {
            return null;
          }
          const stringIdx = legend.tokenTypes.indexOf("string");
          if (stringIdx === -1) {
            return null;
          }
          const gtsAttributeIndex =
            legend.tokenModifiers.indexOf("gtsAttribute");
          const result: SemanticToken[] = [];
          const text = document.getText();
          for (const mapping of virtualCode.mappings) {
            if (mapping.data.literalFromId) {
              const offset = mapping.generatedOffsets[0];
              const length = mapping.generatedLengths?.[0] ?? mapping.lengths[0];
              const pos = document.positionAt(offset);
              result.push([pos.line, pos.character, length, stringIdx, 0]);
            }
            if (gtsAttributeIndex >= 0 && mapping.data.gtsAttribute) {
              const offset = mapping.generatedOffsets[0];
              const length = mapping.generatedLengths?.[0] ??mapping.lengths[0];
              const pos = document.positionAt(offset);
              const char = text[offset];
              if (char === '"' || char === "'") {
                // A GTS attribute name with quotation, that will not have TS semantic token ("member")
                // we add it as "string" with "gtsAttribute" modifier too.
                result.push([
                  pos.line,
                  pos.character,
                  length,
                  stringIdx,
                  1 << gtsAttributeIndex,
                ]);
              }
            }
          }
          return result;
        },
      };
    },
  };
};
