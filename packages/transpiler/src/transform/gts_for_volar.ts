import { decode } from "@jridgewell/sourcemap-codec";
import type {
  CodeInformation,
  CodeMapping,
  Mapping,
} from "@volar/language-core";
import type { AST } from "../types";
import { walk, type Visitors } from "zimmerframe";
import type { SourceInfo, TranspileResult } from ".";
import { print } from "esrap";
import tsPrinter from "esrap/languages/ts";
import type {
  ArrayExpression,
  ArrowFunctionExpression,
  BlockStatement,
  Declaration,
  EmptyStatement,
  ExportNamedDeclaration,
  Expression,
  ExpressionStatement,
  GTSDefineStatement,
  Identifier,
  Literal,
  MemberExpression,
  Node,
  ObjectExpression,
  ObjectPattern,
  Program,
  Statement,
  VariableDeclarator,
} from "estree";
import { GtsTranspilerError } from "../error";
import {
  commonGtsVisitor,
  initialTranspileState,
  type TranspileState,
} from "./gts";

export interface VolarMappingResult {
  code: string;
  mappings: CodeMapping[];
}

const DEFAULT_VOLAR_MAPPING_DATA: CodeInformation = {
  completion: true,
  format: true,
  navigation: true,
  semantic: true,
  structure: true,
  verification: true,
};

// Helper to create a line-to-offset lookup table
function createOffsetLookup(content: string): number[] {
  const lines = content.split("\n");
  const offsets: number[] = [];
  let currentOffset = 0;

  for (const line of lines) {
    offsets.push(currentOffset);
    // +1 for the newline character (handle \r\n vs \n if necessary)
    currentOffset += line.length + 1;
  }

  return offsets;
}

interface SourceMap {
  mappings: string;
}

export interface TypingTranspileState extends TranspileState {
  idCounter: number;
  currentVmName: string | null;
  /** Pending statements to be inserted to the top-level */
  pendingStatements: Statement[];
}

const EMPTY: EmptyStatement = { type: "EmptyStatement" };

const ANY = {
  type: "TSAnyKeyword",
};

const gtsToTypingsWalker: Visitors<Node, TypingTranspileState> = {
  Program(node, { state, visit }) {
    const body: Program["body"] = [];
    for (const stmt of node.body) {
      if (
        (stmt as Statement | GTSDefineStatement).type === "GTSDefineStatement"
      ) {
        visit(stmt);
        body.push(...state.pendingStatements);
        state.pendingStatements = [];
      } else {
        body.push(visit(stmt) as Statement);
      }
    }
    if (state.externalizedBindings.length > 0) {
      body.unshift(
        {
          type: "ImportDeclaration",
          specifiers: [
            {
              type: "ImportDefaultSpecifier",
              local: state.binderFnId,
            },
          ],
          source: {
            type: "Literal",
            value: `${state.providerImportSource}/binder`,
          },
          attributes: [],
        },
        ...state.externalizedBindings.flatMap(
          (binding): (Declaration | ExportNamedDeclaration)[] => {
            const internalDecl: Declaration = {
              type: "VariableDeclaration",
              kind: "const",
              declarations: [
                {
                  type: "VariableDeclarator",
                  id: binding.internalId,
                  init: binding.value,
                },
              ],
            };
            const externalDecl: Declaration = {
              type: "VariableDeclaration",
              kind: "const",
              declarations: [
                {
                  type: "VariableDeclarator",
                  id: binding.bindingName,
                  init: {
                    type: "CallExpression",
                    optional: false,
                    callee: state.binderFnId,
                    arguments: [
                      binding.internalId,
                      {
                        type: "ObjectExpression",
                        properties: [
                          {
                            type: "Property",
                            key: { type: "Identifier", name: "path" },
                            computed: false,
                            kind: "init",
                            method: false,
                            shorthand: false,
                            value: {
                              type: "ArrayExpression",
                              elements: binding.path.map((segment) => ({
                                type: "Literal",
                                value: segment,
                              })),
                            },
                          },
                        ],
                      },
                    ],
                  },
                },
              ],
            };
            return binding.export
              ? [
                  internalDecl,
                  {
                    type: "ExportNamedDeclaration",
                    declaration: externalDecl,
                    specifiers: [],
                    attributes: [],
                  },
                ]
              : [internalDecl, externalDecl];
          }
        )
      );
    }
    if (state.hasQueryExpressions) {
      body.unshift({
        type: "ImportDeclaration",
        specifiers: [
          {
            type: "ImportDefaultSpecifier",
            local: state.queryFnId,
          },
        ],
        source: {
          type: "Literal",
          value: `${state.providerImportSource}/query`,
        },
        attributes: [],
      });
    }
    return {
      ...node,
      body,
    };
  },
  GTSDefineStatement(node, { state, visit }) {
    state.currentVmName = `__gts_vm_${state.idCounter++}`;
    let lhsObjTypeId: Identifier = {
      type: "Identifier",
      name: `${state.currentVmName}__objType`,
    };
    let lhsObjId: Identifier = {
      type: "Identifier",
      name: `${state.currentVmName}__obj`,
    };
    state.pendingStatements.push({
      type: "TSTypeAliasDeclaration",
      id: lhsObjTypeId,
      typeAnnotation: ANY,
    } as any);
    state.pendingStatements.push({
      type: "VariableDeclaration",
      kind: "let",
      declarations: [
        {
          type: "VariableDeclarator",
          id: lhsObjId,
          typeAnnotation: {
            type: "TSTypeReference",
            typeName: lhsObjTypeId,
          },
          definite: true,
        } as VariableDeclarator,
      ],
    });
    visit(node.body) as ExpressionStatement;
    state.currentVmName = null;
    return EMPTY;
  },
  GTSNamedAttributeDefinition(node, { visit, state }) {
    visit(node.body);

    if (node.bindingName) {
      if (node.bindingAccessModifier === "protected") {
        throw new GtsTranspilerError(
          "Protected bindings are not supported in this context.",
          node.loc ?? null
        );
      }
      const export_ = node.bindingAccessModifier !== "private";
      const internalId: Identifier = {
        type: "Identifier",
        name: `__gts_internal_binding_${state.externalizedBindings.length}`,
      };
      state.externalizedBindings.push({
        bindingName: node.bindingName,
        export: export_,
        internalId,
        value: { type: "Literal", value: null }, // TODO
        path: [...state.attributeNames, node.name].map((n) => {
          if (n.type === "Literal") {
            return String(n.value);
          } else {
            return n.name;
          }
        }),
      });
    }
    return EMPTY;
  },
  GTSAttributeBody(node, { state, visit }) {
    if (!state.currentVmName) {
      return EMPTY;
    }
    const positionals = visit(node.positionalAttributes) as ArrayExpression;
    if (node.namedAttributes) {
      visit(node.namedAttributes);
    }
    return EMPTY;
  },
  GTSPositionalAttributeList(node, { visit }): ArrayExpression {
    return {
      type: "ArrayExpression",
      elements: node.attributes.map((attr): Expression => {
        if (attr.type === "Identifier" && /^[a-z_]/.test(attr.name)) {
          return {
            ...attr,
            type: "Literal",
            value: attr.name,
          };
        } else {
          return visit(attr) as Expression;
        }
      }),
      loc: node.loc,
    };
  },
  GTSNamedAttributeBlock(node, { visit }): ObjectExpression {
    const attributes = node.attributes.map((node) => visit(node) as Expression);
    if (node.directAction) {
      attributes.push(visit(node.directAction) as Expression);
    }
    return {
      type: "ObjectExpression",
      properties: [
        {
          type: "Property",
          key: { type: "Identifier", name: "attributes" },
          computed: false,
          kind: "init",
          method: false,
          shorthand: false,
          value: {
            type: "ArrayExpression",
            elements: attributes,
          },
        },
      ],
      loc: node.loc,
    };
  },
  ...(commonGtsVisitor as Visitors<Node, TypingTranspileState>),
};

export function gtsToTypings(ast: AST.Program): TranspileResult {
  const state: TypingTranspileState = {
    ...initialTranspileState(),
    idCounter: 0,
    currentVmName: null,
    pendingStatements: [],
  };
  const newAst = walk(ast as AST.Node, state, gtsToTypingsWalker);
  const { code, map } = print(
    newAst,
    tsPrinter({
      getLeadingComments: (node) => (node as AST.Node).leadingComments,
      getTrailingComments: (node) => (node as AST.Node).trailingComments,
    }),
    {
      indent: "  ",
    }
  );
  return {
    code,
    sourceMap: map,
  };
}

export function convertToVolarMappings(
  code: string,
  source: string,
  sourceMap: SourceMap
): CodeMapping[] {
  const decodedLines = decode(sourceMap.mappings);
  const volarMappings: CodeMapping[] = [];

  // 1. Prepare offset lookups
  const generatedLineOffsets = createOffsetLookup(code);
  const sourceLineOffsets = createOffsetLookup(source);

  // 2. Iterate over the decoded standard mappings
  decodedLines.forEach((segments, genLineIndex) => {
    const genLineStartOffset = generatedLineOffsets[genLineIndex];

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      const nextSegment = segments[i + 1];

      // Standard map segment: [genCol, sourceIndex, sourceLine, sourceCol, nameIndex]
      // We only care about mapped segments (length 4 or 5)
      if (segment.length === 4 || segment.length === 5) {
        const [genCol, sourceIndex, sourceLine, sourceCol] = segment;

        const generatedOffset = genLineStartOffset + genCol;
        const sourceOffset = sourceLineOffsets[sourceLine] + sourceCol;

        // Calculate Length
        // Standard maps are points, Volar maps are ranges.
        // We infer length by looking at the next segment's start or end of line.
        let length = 0;
        if (nextSegment) {
          length = nextSegment[0] - genCol;
        } else {
          // If it's the last segment in the line, length goes to end of line
          // (You might need logic here to exclude newline chars depending on exact needs)
          const lineLength =
            (generatedLineOffsets[genLineIndex + 1] || code.length + 1) -
            1 -
            genLineStartOffset;
          length = lineLength - genCol;
        }

        // 3. Construct the Volar Mapping
        volarMappings.push({
          sourceOffsets: [sourceOffset],
          generatedOffsets: [generatedOffset],
          lengths: [length],
          data: DEFAULT_VOLAR_MAPPING_DATA, // Populate with specific data if your tooling needs semantic info
        });
      }
    }
  });

  return volarMappings;
}
