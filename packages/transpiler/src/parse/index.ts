import { Parser } from "acorn";
import type { Program } from "estree";
import { tsPlugin } from "@sveltejs/acorn-typescript";
import { gtsPlugin, type GtsPluginOption } from "./gts_plugin.js";
import { loosePlugin } from "./loose_plugin.js";
import { getCommentHandlers } from "./comment.js";
import { GtsTranspilerError } from "../error.js";

const TsParser = Parser.extend(tsPlugin());

export function parse(input: string, options?: GtsPluginOption): Program {
  try {
    const GtsParser = TsParser.extend(gtsPlugin(options));
    return GtsParser.parse(input, {
      ecmaVersion: "latest",
      sourceType: "module",
      locations: true,
    }) as Program;
  } catch (e) {
    if (e instanceof SyntaxError && "loc" in e) {
      const loc = e.loc as Position;
      throw new GtsTranspilerError(e.message, {
        start: loc,
        end: { line: loc.line, column: loc.column + 1 },
      });
    } else {
      throw new GtsTranspilerError((e as Error)?.message, null);
    }
  }
}

export function parseLoose(input: string, options?: GtsPluginOption): Program {
  try {
    const GtsParser = TsParser.extend(
      loosePlugin(),
      gtsPlugin({
        ...options,
        allowEmptyShortcutMember: true,
        allowEmptyPositionalAttribute: true,
      })
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
  } catch (e) {
    if (e instanceof SyntaxError && "loc" in e) {
      const loc = e.loc as Position;
      throw new GtsTranspilerError(e.message, {
        start: loc,
        end: { line: loc.line, column: loc.column + 1 },
      });
    } else {
      throw new GtsTranspilerError((e as Error)?.message, null);
    }
  }
}
