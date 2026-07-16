import { create } from "volar-service-typescript";
import type { LanguageServicePlugin } from "@volar/language-server";

export function createTypeScriptServices(
  ts: typeof import("typescript"),
): LanguageServicePlugin[] {
  const services = create(ts);
  const semanticService = services.find(
    (service) => service.name === "typescript-semantic",
  );
  // make space triggers signature help too.
  // GTS have syntax `name arg1, arg2` transpiled to `name(arg1, arg2)`
  // the space after `name` will trigger a request for signature help
  if (semanticService?.capabilities.signatureHelpProvider?.triggerCharacters) {
    semanticService.capabilities.signatureHelpProvider.triggerCharacters.push(
      " ",
    );
  }
  if (semanticService?.capabilities.semanticTokensProvider?.legend) {
    semanticService.capabilities.semanticTokensProvider.legend.tokenModifiers.push(
      "gtsAttribute",
    );
  }
  // Remove document formatting ability, use Prettier instead (from client config)
  const syntacticService = services.find(
    (service) => service.name === "typescript-syntactic",
  );
  delete syntacticService?.capabilities.documentFormattingProvider;
  return services;
}
