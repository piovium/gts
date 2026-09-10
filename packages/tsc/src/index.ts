import { runTsc } from "@volar/typescript/lib/quickstart/runTsc.js";
import { createRequire } from "node:module";
import { createGtscProject } from "./project.ts";

const require = createRequire(import.meta.url);
// `runTsc` intercepts reading this file and rewrites it before loading, so it
// needs the path rather than the module.
const tscPath = require.resolve("typescript/lib/tsc");
const extraSupportedExtensions = [".gts"];

runTsc(tscPath, extraSupportedExtensions, createGtscProject);
