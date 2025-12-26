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
  type TranspileOption,
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
  vmNameStack: string[];
  /** Pending statements to be inserted to the top-level */
  pendingStatements: Statement[];
}

const EMPTY: EmptyStatement = { type: "EmptyStatement" };

const ANY = {
  type: "TSAnyKeyword",
};

const enterVM = (state: TypingTranspileState, vmId: string): string => {
  const vmName = `__gts_vm_${state.idCounter++}`;
  state.vmNameStack.push(vmName);
  let lhsObjTypeId: Identifier = {
    type: "Identifier",
    name: `${vmName}__objType`,
  };
  let lhsObjId = {
    type: "Identifier",
    name: `${vmName}__obj`,
    typeAnnotation: {
      type: "TSTypeAnnotation",
      typeAnnotation: {
        type: "TSTypeReference",
        typeName: lhsObjTypeId,
      },
    },
  } as Identifier;
  state.pendingStatements.push({
    type: "TSTypeAliasDeclaration",
    id: lhsObjTypeId,
    typeAnnotation: ANY, // TODO
  } as any);
  state.pendingStatements.push({
    type: "VariableDeclaration",
    kind: "let",
    declarations: [
      {
        type: "VariableDeclarator",
        id: lhsObjId,
        // definite not supported by esrap yet
        // https://github.com/sveltejs/esrap/issues/95
        init: {
          type: "TSAsExpression",
          expression: { type: "Literal", value: 0 },
          typeAnnotation: ANY,
        } as {} as Expression,
      },
    ],
  });
  return vmName;
};
const exitVM = (state: TypingTranspileState) => {
  state.vmNameStack.pop();
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
    enterVM(state, `__root_vm`);
    visit(node.body) as ExpressionStatement;
    exitVM(state);
    return EMPTY;
  },
  GTSNamedAttributeDefinition(node, { visit, state }) {
    const { name, body, bindingName } = node;
    const currentVmName = state.vmNameStack.at(-1);
    if (!currentVmName) {
      return EMPTY;
    }
    const positionals = body.positionalAttributes.attributes.map(
      (attr): Expression => {
        if (attr.type === "Identifier" && /^[a-z_]/.test(attr.name)) {
          return {
            ...attr,
            type: "Literal",
            value: attr.name,
          };
        } else {
          return visit(attr) as Expression;
        }
      }
    );
    const returnValueName: Identifier = {
      type: "Identifier",
      name: `__gts_attrRet_${state.idCounter++}`,
    };
    state.pendingStatements.push({
      type: "VariableDeclaration",
      kind: "const",
      declarations: [
        {
          type: "VariableDeclarator",
          id: returnValueName,
          init: {
            type: "CallExpression",
            optional: false,
            callee: {
              type: "MemberExpression",
              object: {
                type: "Identifier",
                name: `${currentVmName}__obj`,
              },
              property: name,
              computed: name.type === "Literal",
              optional: false,
            },
            arguments: positionals,
          },
        },
      ],
    });
    if (body.namedAttributes) {
      visit(body.namedAttributes);
    }

    if (bindingName) {
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
        bindingName,
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
    return EMPTY;
  },
  GTSNamedAttributeBlock(node, { state, visit }) {
    enterVM(state, `__attr_vm`);
    for (const attr of node.attributes) {
      visit(attr);
    }
    if (node.directAction) {
      visit(node.directAction);
    }
    exitVM(state);

    return EMPTY;
  },
  ...(commonGtsVisitor as Visitors<Node, TypingTranspileState>),
};

export function gtsToTypings(
  ast: AST.Program,
  option: TranspileOption
): TranspileResult {
  const state: TypingTranspileState = {
    ...initialTranspileState(option),
    idCounter: 0,
    vmNameStack: [],
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
          return;
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
