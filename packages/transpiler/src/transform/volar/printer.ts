import tsPrinter from "esrap/languages/ts";
import type { AST } from "../../types";
import type { Context, Visitors } from "esrap";
import type { SimpleCallExpression } from "estree";

const printer = tsPrinter({
  getLeadingComments: (node) => (node as AST.Node).leadingComments,
  getTrailingComments: (node) => (node as AST.Node).trailingComments,
});

// Make the print of dummy identifier print nothing.
// Exception: if GTS attribute list's last argument is dummy, e.g.
//     foo bar, ;
//             ^~ here
// Then the printed JS will be `foo(bar, )` which WILL NOT be syntax error in ES6.
// So we mark the lastArg manually and print an additional comma
// for this dummy identifier, i.e. `foo(bar,,)` and TypeScript will recognize the error.

const prevIdentifier = printer.Identifier!;
printer.Identifier = function (node, context) {
  if (node.isDummy) {
    const text = Reflect.get(node, "lastArg") ? "," : "";
    context.write(text, node);
  } else {
    prevIdentifier(node, context);
  }
};

const prevCallNewExpression = printer.CallExpression!;
const newCallNewExpression: typeof prevCallNewExpression = function (
  node: SimpleCallExpression,
  context,
) {
  const lastArg = node.arguments.at(-1);
  if (lastArg) {
    Reflect.set(lastArg, "lastArg", true);
  }
  if (!node.lParenLoc) {
    return prevCallNewExpression(node, context);
  }
  let hasDeferredWrite = false;
  let interceptionDone = false;
  const lParenFakeNode = {
    loc: node.lParenLoc!,
  } as AST.Node;

  // Map the print of `(` with the fake lParen node.
  // The print of `(` can be happened in two area:
  // 1. The wrapped parenthesis towards callee, which follows a `context.visit` to the callee;
  // 2. The argument list (what we should map), which follows a `context.append` call
  // so we defer the write of `(` to the next call of `context.visit|append`.
  // If it is `context.append`, then make `context.write("(")` happens with our fake node
  // and mapping will be added to the final code-mapping. Otherwise, keep original write.

  const patchedWrite = (text: string, node?: AST.Node) => {
    if (text === "(") {
      hasDeferredWrite = true;
    } else {
      context.write(text, node);
    }
  };
  const patchedVisit = (node: AST.Node) => {
    if (hasDeferredWrite) {
      context.write("(");
    }
    return context.visit(node);
  };
  const patchedAppend = (subcontext: Context) => {
    if (hasDeferredWrite) {
      context.write("(", lParenFakeNode);
      // console.log("Inserted fake [LPAREN] for node at ", lParenFakeNode.loc);
      interceptionDone = true;
    }
    return context.append(subcontext);
  };
  const proxiedContext = new Proxy(context, {
    get(target, prop) {
      if (!interceptionDone) {
        if (prop === "write") {
          return patchedWrite;
        }
        if (prop === "visit") {
          return patchedVisit;
        }
        if (prop === "append") {
          return patchedAppend;
        }
      }
      const value = Reflect.get(target, prop);
      if (typeof value === "function") {
        return value.bind(target);
      }
      return value;
    },
  });
  return prevCallNewExpression(node, proxiedContext);
};
printer.CallExpression = newCallNewExpression;
printer.NewExpression = newCallNewExpression;

export const patchedPrinter: Visitors<AST.Node> = printer;
