import type {
  LanguageServicePluginInstance,
  LanguageServicePlugin,
} from "@volar/language-server";
import { getVirtualCode, getWordFromPosition } from "./utils";

export function createDocumentHighlightPlugin(): LanguageServicePlugin {
  return {
    name: "gts-document-highlight",
    capabilities: {
      documentHighlightProvider: true,
    },
    create(context) {
      let originalProvideDocumentHighlights: LanguageServicePluginInstance["provideDocumentHighlights"];
      let originalInstance: LanguageServicePluginInstance;

      // Get TypeScript's document highlights provider
      for (const [plugin, instance] of context.plugins) {
        if (
          plugin.name === "typescript-semantic" &&
          instance.provideDocumentHighlights
        ) {
          originalInstance = instance;
          originalProvideDocumentHighlights =
            instance.provideDocumentHighlights;
          instance.provideDocumentHighlights = undefined;
          break;
        }
      }

      if (!originalProvideDocumentHighlights) {
        console?.log(
          "'typescript-semantic plugin' was not found or has no 'provideDocumentHighlights'. \
					Document highlights will be limited to custom GamingTS keywords only."
        );
      }

      return {
        async provideDocumentHighlights(document, position, token) {
          if (!originalProvideDocumentHighlights) {
            return null;
          }

          let tsHighlights = await originalProvideDocumentHighlights.call(
            originalInstance,
            document,
            position,
            token
          );

          if (!tsHighlights || tsHighlights.length > 0) {
            // If TypeScript recognized tokens and provided highlights, return them
            return tsHighlights;
          }

          const [virtualCode] = getVirtualCode(document, context);

          if (!virtualCode) {
            return tsHighlights;
          }

          // Check if we're on a custom Ripple keyword
          const offset = document.offsetAt(position);
          const text = document.getText();

          // Find word boundaries
          const { word } = getWordFromPosition(text, offset);

          // If the word is a Ripple keyword, find all occurrences in the document

          const regex = new RegExp(`\\b${word}\\b`, "g");
          let match;

          // while ((match = regex.exec(text)) !== null) {
          //   const start = match.index;
          //   const end = match.index + word.length;
          //   const mapping = virtualCode.findMappingByGeneratedRange(start, end);

          //   if (!mapping) {
          //     // If no mapping, skip all others as well
          //     // This shouldn't happen as TS handles only mapped ranges
          //     return tsHighlights;
          //   }

          //   if (!mapping.data.customData?.wordHighlight?.kind) {
          //     // Skip if we didn't define word highlighting in segments
          //     continue;
          //   }

          //   if (!tsHighlights) {
          //     tsHighlights = [];
          //   }

          //   tsHighlights.push({
          //     range: {
          //       start: document.positionAt(start),
          //       end: document.positionAt(end),
          //     },

          //     kind: mapping.data.customData.wordHighlight.kind,
          //   });
          // }

          if (tsHighlights.length > 0) {
            console?.log(`Found ${tsHighlights.length} occurrences of '${word}'`);
          }

          // Return TypeScript highlights if no custom keyword was found
          return [...tsHighlights];
        },
      };
    },
  };
}
