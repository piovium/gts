import {
  type LanguageServicePlugin,
  type LanguageServicePluginInstance,
} from "@volar/language-server";
import { getVirtualCode } from "./utils.ts";

export const createSemanticTokensPlugin = (): LanguageServicePlugin => {
  return {
    name: "gts-semantic-tokens",
    capabilities: {
      semanticTokensProvider: {
        legend: {
          tokenTypes: [],
          tokenModifiers: [],
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
                (m) => m.generatedOffsets[0] === offset && m.data.semantic,
              );
              if (mapping) {
                console.log(
                  `Mapping found for method token at line ${line}, character ${character}`,
                );
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
      return {};
    },
  };
};
