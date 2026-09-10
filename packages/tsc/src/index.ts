import { runTsc } from "@volar/typescript/lib/quickstart/runTsc.js";
import { createRequire } from "node:module";
import { createGtscProject } from "./project.ts";

const require = createRequire(import.meta.url);
const tscPath = require.resolve("typescript/lib/tsc");

runTsc(tscPath, [".gts"], createGtscProject);
