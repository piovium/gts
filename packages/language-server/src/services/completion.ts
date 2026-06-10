import {
  type LanguageServicePlugin,
  type LanguageServicePluginInstance,
} from "@volar/language-server";

// Lets extend TS's completion provider to support `:`-auto-completion

export const createCompletionPlugin = (): LanguageServicePlugin => {
  return {
    name: "gts-completion",
    capabilities: {
      completionProvider: {
        triggerCharacters: [":"],
      },
    },
    create: (context) => {
      let tsProvideCompletionItems: LanguageServicePluginInstance["provideCompletionItems"];

      for (const [plugin, instance] of context.plugins) {
        if (
          plugin.name === "typescript-semantic" &&
          instance.provideCompletionItems
        ) {
          let originalProvideCompletionItems = instance.provideCompletionItems;
          tsProvideCompletionItems = instance.provideCompletionItems = async (
            ...args
          ) => {
            const response = await originalProvideCompletionItems.apply(
              instance,
              args,
            );
            if (!response) {
              return response;
            }
            const items = response.items.filter(
              (item) => !item.label.startsWith("__gts_"),
            );
            return { ...response, items };
          };
        }
      }

      if (!tsProvideCompletionItems) {
        console.warn(`TS's original provideCompletionItems not found`);
        return {};
      }
      return {
        provideCompletionItems: async (document, position, context, token) => {
          if (context.triggerCharacter === ":") {
            context.triggerCharacter = ".";
            return await tsProvideCompletionItems(
              document,
              position,
              context,
              token,
            );
          }
          return null;
        },
      };
    },
  };
};
