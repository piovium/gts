import { canStartConciseBody, type AST } from "espolar";

function isGtsShortcutArgument(node: AST.Node) {
  return (node.type as string) === "GTSShortcutArgumentExpression";
}

function canStartConciseBodyGts(node: AST.Expression | AST.BlockStatement | AST.PrivateIdentifier): boolean {
  return canStartConciseBody(node, isGtsShortcutArgument);
}

export function isGtsShortcutArgumentStartingConciseBody(node: AST.Expression | AST.BlockStatement | AST.PrivateIdentifier): boolean {
  return !canStartConciseBodyGts(node) && canStartConciseBody(node);
}
