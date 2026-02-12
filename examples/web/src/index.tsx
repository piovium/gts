/* @refresh reload */
import { render } from "solid-js/web";
import "./index.css";

function App() {
  return (
    <>
      <h1>Vite + Solid</h1>
    </>
  );
}

const root = document.getElementById("root");
render(() => <App />, root!);
