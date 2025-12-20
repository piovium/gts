import type { TextDocument } from "vscode-languageserver-textdocument";
import type { LanguageServiceContext } from "@volar/language-server";

import { URI } from "vscode-uri";
import { gtsLanguagePlugin, type GtsVirtualCode } from "./language_plugin";

/**
 * Get virtual code from the encoded document URI
 */
export function getVirtualCode(
  document: TextDocument,
  context: LanguageServiceContext
): [GtsVirtualCode, URI] {
  const uri = URI.parse(document.uri);
  const decoded = context.decodeEmbeddedDocumentUri(uri) as [
    documentUri: URI,
    embeddedCodeId: string
  ];
  const [sourceUri, virtualCodeId] = decoded;
  const sourceScript = context.language.scripts.get(sourceUri);
  const virtualCode = sourceScript?.generated?.embeddedCodes.get(
    virtualCodeId
  ) as GtsVirtualCode;

  return [virtualCode, sourceUri];
}

const wordRegex = /\w/;

/**
 * Get the word at a specific position in the text
 */
export function getWordFromPosition(
  text: string,
  start: number
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
