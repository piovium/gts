import type { Language } from "@volar/language-core";
import type ts from "typescript";
import type { URI } from "vscode-uri";

type Ts = typeof ts;

/** Script text a native checker can consume without a JavaScript syntax tree. */
export interface TnbSourceText {
  readonly text: string;
  readonly scriptKind: ts.ScriptKind;
}

/** Text-only compiler host capability that `typescript-native-bridge` looks for. */
export type TnbGetSourceText = (fileName: string) => TnbSourceText | undefined;

/** Compiler host that carries the capability above. */
export type TnbTextHost = ts.CompilerHost & {
  tnbGetSourceText?: TnbGetSourceText;
};

/**
 * Answer the native bridge's text-only request for one file.
 *
 * The bridge forwards text to its native program and never reads the JavaScript
 * syntax tree that a `SourceFile` carries, so without this capability its host
 * adapter parses every file twice. `undefined` is authoritative: this host has
 * no such file.
 */
export function createTnbGetSourceText(
  ts: Ts,
  host: ts.CompilerHost,
  language: Language<URI | string>,
): TnbGetSourceText {
  // Volar regenerates a file's virtual code from snapshot identity, and only a
  // replaced `SourceFile` would have produced one; a text-only host owns that
  // refresh instead, so re-read text is always answered from fresh code.
  const snapshots = new Map<string, { text: string; snapshot: ts.IScriptSnapshot }>();
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
    const serviceScript =
      sourceScript?.generated?.languagePlugin.typescript?.getServiceScript(
        sourceScript.generated.root,
      );
    if (!serviceScript) {
      return { text, scriptKind: scriptKindOf(ts, fileName) };
    }
    const snapshot = serviceScript.code.snapshot;
    const virtualText = snapshot.getText(0, snapshot.getLength());
    return {
      text: serviceScript.preventLeadingOffset
        ? virtualText
        : leadingOffset(text) + virtualText,
      scriptKind: serviceScript.scriptKind,
    };
  };
}

/**
 * `typescript` exposes this at runtime but omits it from its public types;
 * Volar's own host resolves script kinds through the same function.
 */
function scriptKindOf(ts: Ts, fileName: string): ts.ScriptKind {
  return (
    ts as Ts & { getScriptKindFromFileName(fileName: string): ts.ScriptKind }
  ).getScriptKindFromFileName(fileName);
}

/** Volar's own host keeps one blank line per source line so offsets map back. */
function leadingOffset(source: string): string {
  return source
    .split("\n")
    .map((line) => " ".repeat(line.length))
    .join("\n");
}
