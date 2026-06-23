import type * as vscode from "vscode";
import * as SVG from "./svg.ts";
import { funnel } from "remeda";

declare global {
  function btoa(str: string): string;
}

type ElementType = keyof typeof SVG;

const COLOR_MAP: Record<keyof typeof SVG, string> = {
  cryo: "#63bacd",
  hydro: "#488ccb",
  pyro: "#d6684b",
  electro: "#917ce8",
  anemo: "#5ca8a6",
  geo: "#d29d5d",
  dendro: "#88b750",
};

export function registerDecorations(
  vscode: typeof import("vscode"),
): vscode.Disposable[] {
  const subscriptions: vscode.Disposable[] = [];
  const decorationTypes = new Map<
    ElementType,
    vscode.TextEditorDecorationType
  >();
  for (const element of Object.keys(SVG) as ElementType[]) {
    decorationTypes.set(
      element,
      vscode.window.createTextEditorDecorationType({
        color: COLOR_MAP[element],
        before: {
          contentIconPath: vscode.Uri.parse(
            `data:image/svg+xml;base64,${btoa(SVG[element])}`,
          ),
          width: "1.1em",
          height: "1.1em",
          textDecoration: "none; vertical-align: middle;",
        },
      }),
    );
  }
  let activeEditor = vscode.window.activeTextEditor;

  const updateDecorations = () => {
    if (!activeEditor) {
      return;
    }
    if (activeEditor.document.languageId !== "gaming-ts") {
      return;
    }
    const text = activeEditor.document.getText();
    let match;
    const regex = new RegExp(`\\b(${Object.keys(SVG).join("|")})\\b`, "ig");
    const decorations = new Map<ElementType, vscode.DecorationOptions[]>();
    while ((match = regex.exec(text))) {
      const startPos = activeEditor.document.positionAt(match.index);
      const endPos = activeEditor.document.positionAt(
        match.index + match[0].length,
      );
      const element = match[1].toLowerCase() as ElementType;
      if (!decorations.has(element)) {
        decorations.set(element, []);
      }
      decorations
        .get(element)!
        .push({ range: new vscode.Range(startPos, endPos) });
    }
    for (const [element, decType] of decorationTypes) {
      activeEditor.setDecorations(decType, decorations.get(element) ?? []);
    }
  };
  const throttledUpdateDecorations = funnel(updateDecorations, {
    minGapMs: 100,
    triggerAt: "start",
  });
  const triggerUpdateDecorations = (throttle: boolean) => {
    if (throttle) {
      throttledUpdateDecorations.call();
    } else {
      updateDecorations();
    }
  };
  if (activeEditor) {
    triggerUpdateDecorations(false);
  }
  vscode.window.onDidChangeActiveTextEditor(
    (editor) => {
      activeEditor = editor;
      if (editor) {
        triggerUpdateDecorations(false);
      }
    },
    null,
    subscriptions,
  );
  vscode.workspace.onDidChangeTextDocument(
    (event) => {
      if (activeEditor && event.document === activeEditor.document) {
        triggerUpdateDecorations(true);
      }
    },
    null,
    subscriptions,
  );
  return subscriptions;
}
