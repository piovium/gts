import { Program } from "estree";
import { walk } from "zimmerframe";

interface TranspileState {}

export function transpile(source: string, ast: Program): string {
  const state: TranspileState = {};
  walk(ast, state, {

  });

}