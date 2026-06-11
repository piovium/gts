import type * as vscode from "vscode";

export function registerDecorations(
  vscode: typeof import("vscode"),
): vscode.Disposable[] {
  const subscriptions: vscode.Disposable[] = [];
  const pyroDecorationType = vscode.window.createTextEditorDecorationType({
    color: "red",
    before: {
      contentIconPath: vscode.Uri.parse(
        "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCIgdmlld0JveD0iMCAwIDI0IDI0Ij48Y2lyY2xlIGN4PSIxMiIgY3k9IjEyIiByPSIxMCIgZmlsbD0icmVkIiAvPjwvc3ZnPg==",
      ),
    },
  });
  let activeEditor = vscode.window.activeTextEditor;
  // TODO: throttle
  const triggerUpdateDecorations = (throttle: boolean) => {
    void throttle;
    if (!activeEditor) {
      return;
    }
    const text = activeEditor.document.getText();
    let match;
    const regex = /\bpyro\b/gi;
    const decorations: vscode.DecorationOptions[] = [];
    while ((match = regex.exec(text))) {
      const startPos = activeEditor.document.positionAt(match.index);
      const endPos = activeEditor.document.positionAt(
        match.index + match[0].length,
      );
      decorations.push({ range: new vscode.Range(startPos, endPos) });
    }
    activeEditor.setDecorations(pyroDecorationType, decorations);
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
