import {
  type LanguageServicePlugin,
  type LanguageServicePluginInstance,
} from "@volar/language-server";

// Lets override TS's completion provider to support `:`-auto-completion

export const createCompletionPlugin = (): LanguageServicePlugin => {
  return {
    name: "gts-completion",
    capabilities: {
      completionProvider: {
        resolveProvider: true,
        triggerCharacters: [":"],
      },
    },
    create: (context) => {
      let originalProvideCompletionItems: LanguageServicePluginInstance["provideCompletionItems"];

      for (const [plugin, instance] of context.plugins) {
        if (plugin.name === "typescript-semantic") {
          originalProvideCompletionItems = instance.provideCompletionItems;
        }
      }

      if (!originalProvideCompletionItems) {
        console.warn(`TS's original provideCompletionItems not found`);
        return {};
      }
      return {
        provideCompletionItems: async (document, position, context, token) => {
          if (context.triggerCharacter === ":") {
            context.triggerCharacter = ".";
            const response = await originalProvideCompletionItems(
              document,
              position,
              context,
              token,
            );
            console.log(context, response);
            return response;
          }
          return null;
        },
      };
    },
  };
};
