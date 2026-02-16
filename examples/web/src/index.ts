import "./index.css";

import { initLocaleLoader } from "monaco-languageclient/vscodeApiLocales";
await initLocaleLoader();

const editorContainer = document.getElementById("editorContainer")!;
const { setupEditor } = await import("./editor");
setupEditor(editorContainer);
