import type { ExpressionStatement } from "estree";
import type { TypingTranspileState } from "./walker";
import { DUMMY_PLACEHOLDER } from "../../parse/loose_plugin";

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
      finalMetaType: string;
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
    symbolsId: { NamedDefinition, MetaSymbol },
  } = state;
  return code.replace(replacementRegex, (_, rawPayload) => {
    const payload: ReplacementPayload = JSON.parse(rawPayload);
    if (payload.type === "enterVMFromRoot") {
      return `type ${payload.defType} = (typeof ${payload.vm})[${NamedDefinition.name}]; type ${payload.metaType} = ${payload.defType}[${MetaSymbol.name}];`;
    } else if (payload.type === "enterVMFromAttr") {
      return `type ${payload.defType} = ${payload.returnType} extends { namedDefinition: infer Def } ? Def : { [${MetaSymbol.name}]: unknown }; type ${payload.metaType} = ${payload.defType}[${MetaSymbol.name}];`;
    } else if (payload.type === "exitVM") {
      return `type ${payload.finalMetaType} = ${payload.metaType};`;
    } else if (payload.type === "enterAttr") {
      return `const ${payload.lhs}: { [${MetaSymbol.name}]: ${payload.metaType} } & Omit<${payload.defType}, ${MetaSymbol.name}> = 0 as any;`;
    } else if (payload.type === "createBindingTyping") {
      const typingIdLhs = `${payload.typingId}_lhs`;
      return `type ${typingIdLhs} = { [${MetaSymbol.name}]: ${payload.finalMetaType}; as: ${payload.defType}[${payload.attrName}] extends { as: infer As } ? As : unknown }; let ${typingIdLhs}!: ${typingIdLhs}; let ${payload.typingId} = ${typingIdLhs}.as(); type ${payload.typingId} = typeof ${payload.typingId};`;
    } else if (payload.type === "exitAttr") {
      return `type ${payload.returnType} = typeof ${payload.returnType}; type ${payload.newMetaType} = ${payload.returnType} extends { rewriteMeta: infer NewMeta extends {} } ? NewMeta : ${payload.oldMetaType}`;
    } else {
      return "";
    }
  });
}
