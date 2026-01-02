import type { ExpressionStatement } from "estree";
import type { TypingTranspileState } from "./walker";

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
      errorLoc?: string;
    }
  | {
      type: "enterAttr";
      defType: string;
      metaType: string;
      lhs: string;
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
  value: ReplacementPayload
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

export function applyReplacements(state: TypingTranspileState, code: string) {
  const replacementRegex = new RegExp(
    "\\b" + state.replacementTag.name + "`(.*?)`",
    "gm"
  );
  const {
    symbolsId: { NamedDefinition, Meta },
  } = state;
  // All replacement should be written in one line to avoid messing up source map
  return code.replace(replacementRegex, (_, rawPayload) => {
    const payload: ReplacementPayload = JSON.parse(rawPayload);
    if (payload.type === "enterVMFromRoot") {
      return `type ${payload.defType} = (typeof ${payload.vm})[${NamedDefinition.name}]; type ${payload.metaType} = ${payload.defType}[${Meta.name}];`;
    } else if (payload.type === "enterVMFromAttr") {
      return `type ${payload.defType} = ${payload.returnType} extends { namedDefinition: infer Def } ? Def : { [${Meta.name}]: unknown }; type ${payload.metaType} = ${payload.defType}[${Meta.name}];`;
    } else if (payload.type === "exitVM") {
      const lhs = `${payload.finalMetaType}_lhs`;
      const requiredAttrsNs = `${payload.finalMetaType}_rans`;
      const collectedAttrsExpr = `${payload.collectedAttrs.join(" | ")}`;
      const needleString = `null! as ${requiredAttrsNs}.RequiredAttributes`;
      if (payload.errorLoc) {
        state.additionalMappings.set(payload.errorLoc, needleString);
      }
      return `type ${payload.finalMetaType} = ${payload.metaType}; const ${lhs}: { [${Meta.name}]: ${payload.metaType} } & Omit<${payload.defType}, ${Meta.name}> = 0 as any; type ${lhs} = typeof ${lhs}; namespace ${requiredAttrsNs} { export type CollectedAttributes = ${collectedAttrsExpr}; export type RequiredAttributes = { [K in keyof ${payload.defType}]: ${lhs}[K] extends { required(this: ${lhs}): true } ? K : never }[keyof ${payload.defType}]; }; ((_: ${requiredAttrsNs}.CollectedAttributes) => 0)(${needleString});`;
    } else if (payload.type === "enterAttr") {
      return `const ${payload.lhs}: { [${Meta.name}]: ${payload.metaType} } & Omit<${payload.defType}, ${Meta.name}> = 0 as any;`;
    } else if (payload.type === "createBindingTyping") {
      const typingIdLhs = `${payload.typingId}_lhs`;
      return `type ${typingIdLhs} = { [${Meta.name}]: ${payload.finalMetaType}; as: ${payload.defType}[${payload.attrName}] extends { as: infer As } ? As : unknown }; let ${typingIdLhs}!: ${typingIdLhs}; let ${payload.typingId} = ${typingIdLhs}.as(); type ${payload.typingId} = typeof ${payload.typingId};`;
    } else if (payload.type === "exitAttr") {
      return `type ${payload.returnType} = typeof ${payload.returnType}; type ${payload.newMetaType} = ${payload.returnType} extends { rewriteMeta: infer NewMeta extends {} } ? NewMeta : ${payload.oldMetaType}`;
    } else {
      return "";
    }
  });
}
