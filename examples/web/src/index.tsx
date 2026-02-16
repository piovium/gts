/* @refresh reload */
import { render } from "solid-js/web";
import "./index.css";
import { onMount } from "solid-js";
import { setupEditor } from "./editor";

function App() {
  let editorContainer!: HTMLDivElement;
  onMount(() => {
    setupEditor(editorContainer);
  });
  return (
    <>
      <h1>GTS LS + Monaco Editor LC</h1>
      <div class="editor-container" ref={editorContainer} />
    </>
  );
}

const root = document.getElementById("root");
render(() => <App />, root!);
