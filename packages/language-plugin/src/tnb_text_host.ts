import type { Language } from "@volar/language-core";
import type ts from "typescript";
import type { URI } from "vscode-uri";
import { blankedSource } from "./virtual_code.ts";

type Ts = typeof ts;

/**
 * Text and script kind of one file: how the native bridge consumes a script
 * instead of a `SourceFile`.
 */
export interface TnbSourceText {
  readonly text: string;
  readonly scriptKind: ts.ScriptKind;
}

/**
 * Text-only read of one file that `typescript-native-bridge` prefers over
 * `getSourceFile`. `undefined` means this host has no such file.
 */
export type TnbGetSourceText = (fileName: string) => TnbSourceText | undefined;

/** A compiler host that may provide `tnbGetSourceText`. */
export type TnbTextHost = ts.CompilerHost & {
  tnbGetSourceText?: TnbGetSourceText;
};

/**
 * Build a `tnbGetSourceText` that answers from Volar's virtual code.
 *
 * Without it the bridge reads through `getSourceFile`, which Volar answers by
 * parsing a JavaScript `SourceFile` (for a `.gts`, raw then virtual) only to
 * hand the text back. This hook returns that same virtual text and script kind
 * without the parse. `undefined` is authoritative: this host has no such file.
 */
export function createTnbGetSourceText(
  ts: Ts,
  host: ts.CompilerHost,
  language: Language<URI | string>,
): TnbGetSourceText {
  // Volar regenerates a script's virtual code whenever `scripts.set` receives a
  // snapshot that is not identical to the stored one, so reuse the same snapshot
  // while the text is unchanged instead of re-transpiling GTS on every read.
  const snapshots = new Map<
    string,
    { text: string; snapshot: ts.IScriptSnapshot }
  >();
  const snapshotOf = (fileName: string, text: string): ts.IScriptSnapshot => {
    const previous = snapshots.get(fileName);
    if (previous?.text === text) {
      return previous.snapshot;
    }
    const snapshot = {
      getChangeRange: () => undefined,
      getLength: () => text.length,
      getText: (start: number, end: number) => text.substring(start, end),
    };
    snapshots.set(fileName, { text, snapshot });
    return snapshot;
  };

  return (fileName) => {
    const text = host.readFile(fileName);
    if (text === undefined) {
      return undefined;
    }
    const sourceScript = language.scripts.set(
      fileName,
      snapshotOf(fileName, text),
    );
    const generated = sourceScript?.generated;
    const serviceScript =
      generated?.languagePlugin.typescript?.getServiceScript(generated.root);
    if (!serviceScript) {
      return { text, scriptKind: scriptKindOf(ts, fileName) };
    }
    const snapshot = serviceScript.code.snapshot;
    const virtualText = snapshot.getText(0, snapshot.getLength());
    return {
      text: serviceScript.preventLeadingOffset
        ? virtualText
        : blankedSource(text) + virtualText,
      scriptKind: serviceScript.scriptKind,
    };
  };
}

/**
 * `typescript` provides `getScriptKindFromFileName` at runtime but leaves it out
 * of its public types, so the SDK is widened here to reach it.
 */
function scriptKindOf(ts: Ts, fileName: string): ts.ScriptKind {
  return (
    ts as Ts & { getScriptKindFromFileName(fileName: string): ts.ScriptKind }
  ).getScriptKindFromFileName(fileName);
}
