import { runTsc } from "@volar/typescript/lib/quickstart/runTsc.js";
import { createRequire } from "node:module";
import { createGtscProject } from "./project.ts";

const require = createRequire(import.meta.url);
// `runTsc` patches `fs.readFileSync` to rewrite tsc as it is loaded, so it needs
// the file path, not the module.
const tscPath = require.resolve("typescript/lib/tsc");

runTsc(tscPath, [".gts"], createGtscProject);
