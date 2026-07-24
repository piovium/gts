import { parseLoose } from "@gi-tcg/gts-transpiler";
import { doc } from "prettier";
import type {
  AstPath,
  Doc,
  Parser,
  ParserOptions,
  Plugin,
  Printer,
  SupportLanguage,
} from "prettier";
import type * as AST from "estree";
import { printers as estreePrinters } from "prettier/plugins/estree";

declare module "estree" {
  export interface BaseNodeWithoutComments {
    start: number;
    end: number;
  }
  interface NodeMap {
    TSParenthesizedType: TSParenthesizedType;
  }
  interface TSParenthesizedType extends AST.BaseNode {
    type: "TSParenthesizedType";
    typeAnnotation: AST.Node;
  }
}

const {
  builders: { group, hardline, indent, join, line, softline },
} = doc;

const AST_FORMAT = "gts-estree";

type Print = (
  selector?: string | number | Array<string | number> | AstPath<unknown>,
) => Doc;

const GTS_VISITOR_KEYS = {
  GTSDefineStatement: ["body"],
  GTSNamedAttributeDefinition: ["name", "body", "bindingName"],
  GTSAttributeBody: ["positionalAttributes", "namedAttributes"],
  GTSPositionalAttributeList: ["attributes"],
  GTSNamedAttributeBlock: ["attributes", "directAction"],
  GTSDirectFunction: ["body"],
  GTSShortcutFunctionExpression: ["returnType", "body"],
  GTSShortcutArgumentExpression: ["property"],
  // produced by @sveltejs/acorn-typescript, but not recognized by prettier.
  TSParenthesizedType: ["typeAnnotation"],
} as const satisfies Record<string, readonly string[]>;

const estreePrinter = estreePrinters.estree as Printer<AST.BaseNode>;
const COMMENT_KEYS = ["leadingComments", "trailingComments"] as const;

function locStart(node: AST.BaseNodeWithoutComments): number {
  return node.start ?? node.range?.[0] ?? 0;
}

function locEnd(node: AST.BaseNodeWithoutComments): number {
  return node.end ?? node.range?.[1] ?? 0;
}

function isGtsNode(
  node: unknown,
): node is Extract<AST.Node, { type: `GTS${string}` }> {
  return (
    typeof node === "object" &&
    node !== null &&
    typeof (node as AST.BaseNodeWithoutComments).type === "string" &&
    (node as AST.BaseNodeWithoutComments).type!.startsWith("GTS")
  );
}

function collectAttachedComments(ast: AST.BaseNode): AST.Comment[] {
  const comments: AST.Comment[] = [];
  const seen = new Set<string>();

  function addComment(comment: AST.Comment): void {
    const key = `${comment.start}:${comment.end}:${comment.type}`;
    if (!seen.has(key)) {
      seen.add(key);
      comments.push(comment);
    }
  }

  function visit(value: unknown): void {
    if (Array.isArray(value)) {
      for (const item of value) {
        visit(item);
      }
      return;
    }
    if (typeof value !== "object" || value === null) {
      return;
    }

    const node = value as AST.BaseNode;
    for (const key of COMMENT_KEYS) {
      const attachedComments = node[key];
      if (Array.isArray(attachedComments)) {
        for (const comment of attachedComments) {
          addComment(comment as AST.Comment & AST.SourceLocation);
        }
      }
    }

    for (const [key, child] of Object.entries(node)) {
      if (
        key === "loc" ||
        key === "range" ||
        key === "metadata" ||
        key === "comments" ||
        COMMENT_KEYS.includes(key as (typeof COMMENT_KEYS)[number])
      ) {
        continue;
      }
      visit(child);
    }
  }

  visit(ast);
  comments.sort((a, b) => locStart(a) - locStart(b));
  return comments;
}

function parseGts(text: string): AST.Program {
  const ast = parseLoose(text);
  ast.comments = collectAttachedComments(ast);
  return ast;
}

function printAttributeName(
  path: AstPath<AST.GTSNamedAttributeDefinition>,
  print: Print,
): Doc {
  return path.call((namePath) => {
    const name = namePath.node;
    if (name.type === "Identifier") {
      return String(name.name);
    }
    return print(namePath as AstPath<unknown>);
  }, "name");
}

function printNodeList<T, const K extends keyof T>(
  path: AstPath<T>,
  print: Print,
  property: K,
): Doc[] {
  return path.map((childPath) => print(childPath), property as any);
}

function printGtsDefineStatement(
  path: AstPath<AST.GTSDefineStatement>,
  print: Print,
): Doc {
  return group(["define ", print("body")]);
}

function printGtsNamedAttributeDefinition(
  path: AstPath<AST.GTSNamedAttributeDefinition>,
  print: Print,
): Doc {
  const node = path.node;
  const parts: Doc[] = [printAttributeName(path, print), print("body")];

  if (node.bindingName) {
    parts.push(
      " as ",
      node.bindingAccessModifier
        ? `${String(node.bindingAccessModifier)} `
        : "",
      print("bindingName"),
    );
  }

  parts.push(";");
  return group(parts);
}

function printGtsAttributeBody(
  path: AstPath<AST.GTSAttributeBody>,
  print: Print,
): Doc {
  const node = path.node;
  const parts: Doc[] = [];
  const positionalAttributes = node.positionalAttributes;

  if (positionalAttributes?.attributes instanceof Array) {
    if (positionalAttributes.attributes.length > 0) {
      parts.push(" ", print("positionalAttributes"));
    }
  }

  if (
    node.namedAttributes &&
    (node.namedAttributes.attributes.length > 0 ||
      node.namedAttributes.directAction)
  ) {
    parts.push(" ", print("namedAttributes"));
  }

  return parts;
}

function printGtsPositionalAttributeList(
  path: AstPath<AST.GTSPositionalAttributeList>,
  print: Print,
): Doc {
  const attributes = path.map((attributePath) => {
    const attribute = attributePath.node as AST.Expression;
    const attributeDoc = print(attributePath);
    if (
      attribute.type === "ArrowFunctionExpression" ||
      attribute.type === "ObjectExpression"
    ) {
      return ["(", attributeDoc, ")"];
    }

    return attributeDoc;
  }, "attributes");

  return group(join([",", line], attributes));
}

function printGtsNamedAttributeBlock(
  path: AstPath<AST.GTSNamedAttributeBlock>,
  print: Print,
  options: ParserOptions<AST.BaseNode>,
): Doc {
  const node = path.node;
  const docs = printNodeList(path, print, "attributes");

  if (node.directAction) {
    docs.push(print("directAction"));
  }

  if (docs.length === 0) {
    return "{}";
  }

  if (node.attributes.length === 1 && !node.directAction) {
    const shouldBreak =
      options.objectWrap === "preserve" &&
      /\r?\n/u.test(
        options.originalText.slice(node.start, node.attributes[0].start),
      );
    return group(["{", indent([line, docs[0]]), line, "}"], { shouldBreak });
  }

  return group(["{", indent([hardline, join(hardline, docs)]), hardline, "}"]);
}

function printGtsDirectFunction(
  path: AstPath<AST.GTSDirectFunction>,
  print: Print,
): Doc {
  const docs = printNodeList(path, print, "body");
  return join(hardline, docs);
}

function printGtsShortcutFunctionExpression(
  path: AstPath<AST.GTSShortcutFunctionExpression>,
  print: Print,
): Doc {
  const returnType = path.node.returnType
    ? ["<", print("returnType"), ">"]
    : [];

  if (path.node.expression) {
    return group([
      ":",
      returnType,
      "( ",
      indent([softline, print("body")]),
      softline,
      " )",
    ]);
  }
  return group([":", returnType, print("body")]);
}

function printGtsShortcutArgumentExpression(
  path: AstPath<AST.GTSShortcutArgumentExpression>,
  print: Print,
): Doc {
  const doc: Doc = [":", print("property")];
  const parent = path.getParentNode() as AST.Node;

  // A shortcut expression at the beginning of an arrow body must be wrapped:
  // `() => :foo` is parsed as the outer shortcut function's closing paren,
  // whereas `() => (:foo)` is unambiguous.
  if (parent?.type === "ArrowFunctionExpression" && parent.body === path.node) {
    return ["(", doc, ")"];
  }

  return doc;
}

function printTsParenthesizedType(
  path: AstPath<AST.TSParenthesizedType>,
  print: Print,
): Doc {
  return ["(", print("typeAnnotation"), ")"];
}

function getGtsVisitorKeys(
  node: AST.BaseNode,
  nonTraversableKeys: Set<string>,
): string[] | undefined {
  const keys: readonly string[] | undefined =
    node.type && node.type in GTS_VISITOR_KEYS
      ? GTS_VISITOR_KEYS[node.type as keyof typeof GTS_VISITOR_KEYS]
      : undefined;

  return keys?.filter(
    (key) => !nonTraversableKeys.has(key) && (node as any)[key] !== undefined,
  );
}

export const languages: SupportLanguage[] = [
  {
    name: "GamingTS",
    parsers: ["gts"],
    extensions: [".gts"],
    aliases: ["gts", "gaming-ts"],
    vscodeLanguageIds: ["gaming-ts"],
  },
];

export const parsers: Plugin<AST.BaseNode>["parsers"] = {
  gts: {
    parse: parseGts,
    astFormat: AST_FORMAT,
    locStart,
    locEnd,
  } satisfies Parser<AST.BaseNode>,
};

export const printers: Plugin<AST.BaseNode>["printers"] = {
  [AST_FORMAT]: {
    ...estreePrinter,
    canAttachComment(node, ancestors): boolean {
      if (isGtsNode(node)) {
        return true;
      }
      return estreePrinter.canAttachComment?.(node, ancestors) ?? true;
    },
    getVisitorKeys(node, nonTraversableKeys): string[] {
      const keys = getGtsVisitorKeys(node, nonTraversableKeys);
      if (keys) {
        return keys;
      }
      return (
        estreePrinter.getVisitorKeys?.(node, nonTraversableKeys) ??
        Object.keys(node).filter((key) => !nonTraversableKeys.has(key))
      );
    },
    print(path: AstPath<AST.Node>, options, print, args): Doc {
      const printChild = print as Print;

      switch (path.node.type) {
        case "GTSDefineStatement":
          return printGtsDefineStatement(
            path as AstPath<AST.GTSDefineStatement>,
            printChild,
          );
        case "GTSNamedAttributeDefinition":
          return printGtsNamedAttributeDefinition(
            path as AstPath<AST.GTSNamedAttributeDefinition>,
            printChild,
          );
        case "GTSAttributeBody":
          return printGtsAttributeBody(
            path as AstPath<AST.GTSAttributeBody>,
            printChild,
          );
        case "GTSPositionalAttributeList":
          return printGtsPositionalAttributeList(
            path as AstPath<AST.GTSPositionalAttributeList>,
            printChild,
          );
        case "GTSNamedAttributeBlock":
          return printGtsNamedAttributeBlock(
            path as AstPath<AST.GTSNamedAttributeBlock>,
            printChild,
            options,
          );
        case "GTSDirectFunction":
          return printGtsDirectFunction(
            path as AstPath<AST.GTSDirectFunction>,
            printChild,
          );
        case "GTSShortcutFunctionExpression":
          return printGtsShortcutFunctionExpression(
            path as AstPath<AST.GTSShortcutFunctionExpression>,
            printChild,
          );
        case "GTSShortcutArgumentExpression":
          return printGtsShortcutArgumentExpression(
            path as AstPath<AST.GTSShortcutArgumentExpression>,
            printChild,
          );
        case "TSParenthesizedType":
          return printTsParenthesizedType(
            path as AstPath<AST.TSParenthesizedType>,
            printChild,
          );
        default:
          return estreePrinter.print(path, options, print, args);
      }
    },
  } satisfies Printer<AST.BaseNode>,
};

const plugin: Plugin<AST.BaseNode> = {
  languages,
  parsers,
  printers,
};

export default plugin;
