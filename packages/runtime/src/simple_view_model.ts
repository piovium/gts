
import type { StandardJSONSchemaV1 } from "@standard-schema/spec";
import { AttributeDefHelper, ViewModel, type IViewModel } from "./view_model.ts";
import type { AttributeReturn } from "./attribute_return.ts";

export type SimpleViewModel<T> = IViewModel<
  T,
  {
    [K in keyof T]-?: {
      (value: T[K]): AttributeReturn.Done;
      uniqueKey(): K;
      required(): {} extends Pick<T, K> ? false : true;
    };
  } & { "~meta": undefined },
  []
>;

export function defineSimpleViewModel<const T extends StandardJSONSchemaV1>(
  schema: T,
): SimpleViewModel<StandardJSONSchemaV1.InferInput<T>> {
  const jsonSchema = schema["~standard"].jsonSchema.input({
    target: "draft-2020-12",
  });
  const Ctor = class SimpleViewModel {};
  const vm = new ViewModel<any, any, []>(Ctor);
  const helper = new AttributeDefHelper(vm);
  const defResult: Record<string, any> = {};
  for (const key of Object.keys(jsonSchema.properties ?? {})) {
    defResult[key] = helper.simpleAttribute()(function (this: any, value) {
      this[key] = value;
    });
  }
  helper["~assignActions"](defResult);
  return vm as any;
}
