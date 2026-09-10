import type { TextDocument } from "vscode-languageserver-textdocument";
import type { LanguageServiceContext } from "@volar/language-server";

import { URI } from "vscode-uri";
import { GtsVirtualCode } from "@gi-tcg/gts-language-plugin";

/**
 * Resolve the GTS virtual code for an embedded document URI, together with the
 * URI of the source document that owns it. The virtual code is null when the
 * embedded URI carries no `GtsVirtualCode`.
 */
export function getVirtualCode(
  document: TextDocument,
  context: LanguageServiceContext,
): [GtsVirtualCode | null, URI] {
  const uri = URI.parse(document.uri);
  const [sourceUri, virtualCodeId] = context.decodeEmbeddedDocumentUri(uri) as [
    documentUri: URI,
    embeddedCodeId: string,
  ];
  const sourceScript = context.language.scripts.get(sourceUri);
  const virtualCode = sourceScript?.generated?.embeddedCodes.get(virtualCodeId);

  if (!(virtualCode instanceof GtsVirtualCode)) {
    return [null, sourceUri];
  }
  return [virtualCode, sourceUri];
}

const wordRegex = /\w/;

/**
 * Return the longest run of word characters that includes or immediately
 * precedes `start`, with its offsets in `text`.
 */
export function getWordFromPosition(
  text: string,
  start: number,
): { word: string; start: number; end: number } {
  let wordStart = start;
  let wordEnd = start;
  while (wordStart > 0 && wordRegex.test(text[wordStart - 1])) {
    wordStart--;
  }
  while (wordEnd < text.length && wordRegex.test(text[wordEnd])) {
    wordEnd++;
  }

  const word = text.substring(wordStart, wordEnd);

  return {
    word,
    start: wordStart,
    end: wordEnd,
  };
}
