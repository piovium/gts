import { CodeLens, type LanguageServicePlugin } from "@volar/language-server";
import { getVirtualCode } from "../utils.ts";

export const createCodeLensPlugin = (): LanguageServicePlugin => {
  return {
    name: "gts-code-lens",
    capabilities: {
      codeLensProvider: {},
    },
    create: (context) => {
      return {
        provideCodeLenses: async (document, token) => {
          const [virtualCode] = getVirtualCode(document, context);
          if (!virtualCode) {
            return [];
          }
          const result: CodeLens[] = [];
          for (const mapping of virtualCode.mappings) {
            if (mapping.data.directActionStub) {
              const startOffset = mapping.generatedOffsets[0];
              const length = mapping.generatedLengths?.[0] ?? mapping.lengths[0];
              const start = document.positionAt(startOffset);
              // two character: "0;"
              const end = document.positionAt(startOffset + length);
              result.push({
                range: { start, end },
                command: {
                  title: "~action",
                  command: "",
                },
              });
            }
          }
          return result;
        },
      };
    },
  };
};
