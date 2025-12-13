import { Parser } from "acorn";
import type { Program } from "estree";
import { tsPlugin } from "@sveltejs/acorn-typescript";
import { gtsPlugin, type GtsPluginOption } from "./gts_plugin.js";

const TsParser = Parser.extend(tsPlugin());

export function parse(input: string, options?: GtsPluginOption): Program {
  const GtsParser = TsParser.extend(gtsPlugin(options));
  return GtsParser.parse(input, {
    ecmaVersion: "latest",
    sourceType: "module",
  }) as Program;
}
