import type { ExpressionStatement } from "estree";
import type { TypingTranspileState } from "./walker";

type ReplacementPayload =
  | {
      type: "preface";
    }
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
      errorLoc?: string;
    }
  | {
      type: "enterAttr";
      defType: string;
      metaType: string;
      lhs: string;
      attrName: string;
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
): string {
  const replacementRegex = new RegExp(
    "\\b" + state.replacementTag.name + "`(.*?)`",
    "gm",
  );
  const { NamedDefinitionLit, MetaLit } = state;
  const NamedDefinition = JSON.stringify(NamedDefinitionLit.value);
  const Meta = JSON.stringify(MetaLit.value);
  const oneLine = (
    strings: TemplateStringsArray,
    ...values: Array<string | number | boolean>
  ): string =>
    strings
      .reduce(
        (result, chunk, index) =>
          result + chunk + (index < values.length ? values[index] : ""),
        "",
      )
      .replace(/\n[ \t]*/g, " ")
      .trim();
  // All replacement should be written in one line to avoid messing up source map
  return code.replace(replacementRegex, (_, rawPayload) => {
    const payload: ReplacementPayload = JSON.parse(rawPayload);
    if (payload.type === "preface") {
      return oneLine`
        namespace ${state.utilNsId.name} {
          export type UniqueKeyProbSegment = "__gts_unique_prob_seg__";
          export type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends ((k: infer I) => void) ? I : never;
        }
      `;
    } else if (payload.type === "enterVMFromRoot") {
      return oneLine`
        type ${payload.defType} = (typeof ${payload.vm})[${NamedDefinition}];
        type ${payload.metaType} = ${payload.defType}[${Meta}];
      `;
    } else if (payload.type === "enterVMFromAttr") {
      return oneLine`
        type ${payload.defType} = ${payload.returnType} extends { namedDefinition: infer Def } ? Def : { ${Meta}: unknown };
        type ${payload.metaType} = ${payload.defType}[${Meta}];
      `;
    } else if (payload.type === "exitVM") {
      const lhs = `${payload.finalMetaType}_lhs`;
      const requiredAttrsNs = `${payload.finalMetaType}_rans`;
      const collectedAttrsExpr = `${payload.collectedAttrs.join(" | ")}`;
      const needleString = `"${requiredAttrsNs}_NeedleString" as any as "required attributes are missing"`;
      if (payload.errorLoc) {
        state.extraMappings.set(payload.errorLoc, needleString);
      }
      return oneLine`
        type ${payload.finalMetaType} = ${payload.metaType};
        let ${lhs}!: { ${Meta}: ${payload.metaType} } & Omit<${payload.defType}, ${Meta}>;
        type ${lhs} = typeof ${lhs};
        namespace ${requiredAttrsNs} {
          export type Collected = ${collectedAttrsExpr};
          export type Expected = { [K in keyof ${payload.defType}]: ${lhs}[K] extends { required(this: ${lhs}): true } ? K : never }[keyof ${payload.defType}];
        };
        ((_: ${requiredAttrsNs}.Expected extends ${requiredAttrsNs}.Collected ? string : ${requiredAttrsNs}.Expected) => 0)(${needleString});
      `;
    } else if (payload.type === "enterAttr") {
      const uniqueKeyLhs = `${payload.lhs}_uniqueKey_lhs`;
      const uniqueKey = `${payload.lhs}_uniqueKey`;
      const uniqueKeyForThis = `${payload.lhs}_uniqueKeyFor_${payload.lhs}`;
      const uniqueKeyHelperIntf = `${payload.defType}_uniqueKeyProbeHelper`;
      const omittedKeys = `${payload.lhs}_omittedKeys`;
      return oneLine`
        type ${uniqueKeyLhs} = {
          ${Meta}: ${payload.metaType}; 
          uniqueKey: ${payload.defType} extends { [${payload.attrName}]: { uniqueKey: infer UniqueKey } } ? UniqueKey : () => 0;
        
        let ${uniqueKeyLhs}!: ${uniqueKeyLhs};
        let ${uniqueKey} = ${uniqueKeyLhs}.uniqueKey();
        type ${uniqueKey} = typeof ${uniqueKey};
        let ${uniqueKeyForThis}!: \`\${${uniqueKey}}\${${state.utilNsId.name}.UniqueKeyProbSegment}${payload.lhs}\`;
        interface ${uniqueKeyHelperIntf} {
          [${uniqueKeyForThis}]: 1;
        }
        type ${omittedKeys} = ${Meta} | (
          ${uniqueKey} extends 0
          ? never                                                 /* no unique requirement */
            : string extends keyof ${uniqueKeyHelperIntf}
              ? keyof ${payload.defType}                          /* too loose, disable all */
              : ${state.utilNsId.name}.UnionToIntersection<
                keyof ${uniqueKeyHelperIntf} & \`\${${uniqueKey}}\${${state.utilNsId.name}.UniqueKeyProbSegment}\${string}\`
              > extends never
                ? ${payload.attrName}                             /* have duplicate, disable this */
                : never
        );
        let ${payload.lhs}!: { ${Meta}: ${payload.metaType} } & Omit<${payload.defType}, ${omittedKeys}>;
      `;
    } else if (payload.type === "createBindingTyping") {
      const typingIdLhs = `${payload.typingId}_lhs`;
      return oneLine`
        type ${typingIdLhs} = {
          ${Meta}: ${payload.finalMetaType};
          as: ${payload.defType} extends { [${payload.attrName}]: { as: infer As } } ? As : unknown;
        };
        let ${typingIdLhs}!: ${typingIdLhs};
        let ${payload.typingId} = ${typingIdLhs}.as();
        type ${payload.typingId} = typeof ${payload.typingId};
      `;
    } else if (payload.type === "exitAttr") {
      return oneLine`
        type ${payload.returnType} = typeof ${payload.returnType};
        type ${payload.newMetaType} = ${payload.returnType} extends { rewriteMeta: infer NewMeta extends {} } ? NewMeta : ${payload.oldMetaType}
      `;
    } else {
      return "";
    }
  });
}
