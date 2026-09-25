import type { ExpressionStatement } from "estree";
import type { TypingTranspileState } from "./walker.ts";
import dedent from "dedent";
import type { CodeMapping } from "@volar/language-core";

interface MatchInfo {
  sourceEnd: number;
  lengthOffset: number;
}

type ReplacementPayload =
  | {
      type: "enterVMFromRoot";
      vm: string;
      defType: string;
      metaType: string;
    }
  | {
      type: "enterVMFromAttr";
      returnType: string;
      defType: string;
      metaType: string;
    }
  | {
      type: "exitVM";
      metaType: string;
      defType: string;
      collectedAttrs: string[];
      finalMetaType: string;
      errorRange?: [number, number];
    }
  | {
      type: "enterAttr";
      defType: string;
      metaType: string;
      lhs: string;
      attrName: string;
      hintOnly: boolean;
    }
  | {
      type: "createBindingTyping";
      finalMetaType: string;
      defType: string;
      attrName: string;
      typingId: string;
    }
  | {
      type: "exitAttr";
      returnType: string;
      defType: string;
      attrName: string;
      innerMetaType: string;
      oldMetaType: string;
      newMetaType: string;
    };

export const createReplacementHolder = (
  state: TypingTranspileState,
  value: ReplacementPayload,
): ExpressionStatement => {
  const rawValue = JSON.stringify(value);
  return {
    type: "ExpressionStatement",
    expression: {
      type: "TaggedTemplateExpression",
      tag: state.replacementTag,
      quasi: {
        type: "TemplateLiteral",
        expressions: [],
        quasis: [
          {
            type: "TemplateElement",
            value: { raw: rawValue },
            tail: true,
          },
        ],
      },
    },
  };
};

export function applyReplacements(
  state: TypingTranspileState,
  code: string,
  mappings: CodeMapping[],
): string {
  const replacementRegex = new RegExp(
    "\\b" + state.replacementTag.name + "`(.*?)(?<!\\\\)`",
    "gm",
  );
  const { NamedDefinitionLit, MetaLit } = state;
  const NamedDefinition = JSON.stringify(NamedDefinitionLit.value);
  const Meta = JSON.stringify(MetaLit.value);
  const matchInfos: MatchInfo[] = [];
  let cumulativeOffset = 0;

  const result = code.replace(
    replacementRegex,
    (match, rawPayload: string, offset: number) => {
      const payload: ReplacementPayload = JSON.parse(
        rawPayload.replace(/\\`/g, "`"),
      );
      let replacement: string;
      if (payload.type === "enterVMFromRoot") {
        replacement = dedent`
        type ${payload.defType} = (typeof ${payload.vm})[${NamedDefinition}];
        type ${payload.metaType} = ${payload.defType}[${Meta}];
      `;
      } else if (payload.type === "enterVMFromAttr") {
        replacement = dedent`
        type ${payload.defType} = ${payload.returnType} extends { namedDefinition: infer Def } ? Def : { ${Meta}: unknown };
        type ${payload.metaType} = ${payload.defType}[${Meta}];
      `;
      } else if (payload.type === "exitVM") {
        const requiredAttrsNs = `${payload.finalMetaType}_rans`;
        const collectedAttrsExpr =
          [...new Set(payload.collectedAttrs)].join(" | ") || "never";
        const length = payload.errorRange
          ? payload.errorRange[1] - payload.errorRange[0]
          : 0;
        // Map both ends explicitly; nested blocks no longer need a copy of
        // their entire source length as padding in every diagnostic string.
        const needleString = `"${requiredAttrsNs}" as string as ${state.utilNsId.name}.RequiredMessage<${requiredAttrsNs}, ${collectedAttrsExpr}>`;
        if (payload.errorRange) {
          state.extraMappings.push({
            sourceOffset: payload.errorRange[0],
            length,
            generatedNeedle: needleString,
          });
        }
        replacement = dedent`
        type ${payload.finalMetaType} = ${payload.metaType};
        type ${requiredAttrsNs} = ${state.utilNsId.name}.RequiredAttrs<${state.utilNsId.name}.WithMeta<${payload.defType}, ${payload.metaType}>>;
        ${state.utilNsId.name}.checkRequired<${requiredAttrsNs}, ${collectedAttrsExpr}>(${needleString});
      `;
      } else if (payload.type === "enterAttr") {
        const uniqueKeyLhs = `${payload.lhs}_uniqueKey_lhs`;
        const uniqueKey = `${payload.lhs}_uniqueKey`;
        const uniqueKeyForThis = `${payload.lhs}_uniqueKeyFor_${payload.lhs}`;
        const uniqueKeyHelperIntf = `${payload.defType}_uniqueKeyProbeHelper`;
        const omittedKeys = `${payload.lhs}_omittedKeys`;
        // Keep Meta inside the receiver's property. Passing it to a generic
        // receiver alias eagerly resolves later probes and can form a cycle.
        replacement = dedent`
        declare const ${uniqueKeyLhs}: { ${Meta}: ${payload.metaType}; uniqueKey: ${state.utilNsId.name}.Member<${payload.defType}, ${payload.attrName}, "uniqueKey", () => 0> };
        let ${uniqueKey} = ${uniqueKeyLhs}.uniqueKey();
        type ${uniqueKey} = typeof ${uniqueKey};
        let ${uniqueKeyForThis}!: \`\${${uniqueKey}}\${${state.utilNsId.name}.UniqueKeyProbSegment}${payload.lhs}\`;
        interface ${uniqueKeyHelperIntf} {
          [${uniqueKeyForThis}]: 1;
        }
        type ${omittedKeys} = ${Meta} | (${uniqueKey} extends 0 ? never : string extends keyof ${uniqueKeyHelperIntf} ? keyof ${payload.defType} : ${state.utilNsId.name}.UnionToIntersection<keyof ${uniqueKeyHelperIntf} & \`\${${uniqueKey}}\${${state.utilNsId.name}.UniqueKeyProbSegment}\${string}\`> extends never ? ${payload.attrName} : never);
        let ${payload.lhs}!: ${payload.hintOnly ? `{}` : `{ ${Meta}: ${payload.metaType} }`} & Omit<${payload.defType}, ${omittedKeys}>;
      `;
      } else if (payload.type === "createBindingTyping") {
        const typingIdLhs = `${payload.typingId}_lhs`;
        // As with uniqueKey, an as() without a Meta-aware this parameter must
        // not force final Meta (which may itself depend on this binding).
        replacement = dedent`
        declare const ${typingIdLhs}: { ${Meta}: ${payload.finalMetaType}; as: ${state.utilNsId.name}.Member<${payload.defType}, ${payload.attrName}, "as", unknown> };
        let ${payload.typingId} = ${typingIdLhs}.as();
        type ${payload.typingId} = typeof ${payload.typingId};
      `;
      } else if (payload.type === "exitAttr") {
        const rewrittenMeta = `${payload.oldMetaType}_rewritten`;
        const mergeFn = `${payload.oldMetaType}_mergeFn`;
        const mergeFnRet = `${payload.oldMetaType}_mergeFnRet`;
        replacement = dedent`
        type ${payload.returnType} = typeof ${payload.returnType};
        type ${rewrittenMeta} = ${payload.returnType} extends { rewriteMeta: infer NewMeta extends {} } ? NewMeta : ${payload.oldMetaType};
        declare const ${mergeFn}: ${state.utilNsId.name}.MergeMeta<${payload.defType}, ${payload.attrName}>;
        let ${mergeFnRet} = ${mergeFn}(null! as ${rewrittenMeta}, null! as ${payload.innerMetaType});
        type ${payload.newMetaType} = [typeof ${mergeFn}] extends [null] ? ${rewrittenMeta} : typeof ${mergeFnRet};
      `;
      } else {
        replacement = "";
      }
      cumulativeOffset += replacement.length - match.length;
      matchInfos.push({
        sourceEnd: offset + match.length,
        lengthOffset: cumulativeOffset,
      });
      return replacement;
    },
  );

  // 调整替换后 mapping 的 generatedOffset
  // 由于替换信息 matchInfos 的 sourceEnd 是有序的，可以二分查找到对应的 lengthOffset
  for (const mapping of mappings) {
    for (let i = 0; i < mapping.generatedOffsets.length; i++) {
      const orig = mapping.generatedOffsets[i];
      let low = 0;
      let high = matchInfos.length;
      while (low < high) {
        const mid = (low + high) >>> 1;
        if (matchInfos[mid].sourceEnd <= orig) {
          low = mid + 1;
        } else {
          high = mid;
        }
      }
      mapping.generatedOffsets[i] =
        orig + (matchInfos[low - 1]?.lengthOffset ?? 0);
    }
  }

  return result;
}
