import { Parser } from "acorn";
import type { Program } from "estree";
import { tsPlugin } from "@sveltejs/acorn-typescript";
import { gtsPlugin, type GtsPluginOption } from "./gts_plugin.js";
import { loosePlugin } from "./loose_plugin.js";
import { getCommentHandlers } from "./comment.js";

const TsParser = Parser.extend(tsPlugin());

export function parse(input: string, options?: GtsPluginOption): Program {
  const GtsParser = TsParser.extend(gtsPlugin(options));
  return GtsParser.parse(input, {
    ecmaVersion: "latest",
    sourceType: "module",
    locations: true,
  }) as Program;
}

export function parseLoose(input: string, options?: GtsPluginOption): Program {
  const GtsParser = TsParser.extend(
    loosePlugin(),
    gtsPlugin({
      ...options,
      allowEmptyShortcutMember: true,
    }),
  );
  const { onComment, addComments } = getCommentHandlers(input, []);
  const ast = GtsParser.parse(input, {
    ecmaVersion: "latest",
    sourceType: "module",
    locations: true,
    onComment,
  }) as Program;
  addComments(ast);
  return ast;
}
