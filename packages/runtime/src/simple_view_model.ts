import type { StandardJSONSchemaV1 } from "@standard-schema/spec";
import {
  AttributeDefHelper,
  createViewModelClass,
  RuntimeViewModel,
  type IViewModel,
  type IViewModelInstance,
} from "./view_model.ts";
import type { AttributeReturn } from "./attribute_return.ts";
import { Ajv2020 } from "ajv/dist/2020.js";
import type { IsSingleton } from "./utilts.ts";

export interface SimpleViewModelOptions {
  /**
   * Recursively parse nested objects as sub-view models.
   */
  recursive?: boolean;
  /**
   * Treat boolean-compatible properties as switches, i.e. the presence
   * of the attribute without a value sets the property to `true`.
   *
   * Ignored if the `recursive` option is enabled and a object value is acceptable.
   */
  booleanSwitch?: boolean;
}

type ExtractObject<T> = T extends object ? T : never;

type IfAll<
  T extends (boolean | undefined)[],
  TrueT,
  FalseT,
> = T[number] extends true ? TrueT : FalseT;

type SimpleViewModelAttribute<
  ValueT,
  Options extends SimpleViewModelOptions,
> = {
  (value: ValueT): AttributeReturn.Done;
} & IfAll<
  [Options["recursive"], IsSingleton<ExtractObject<ValueT>>],
  {
    (): AttributeReturn.With<
      IViewModelInstance<ISimpleViewModel<ExtractObject<ValueT>, Options>>
    >;
  },
  IfAll<
    [Options["booleanSwitch"], true extends ValueT ? true : false],
    { (): AttributeReturn.Done },
    {}
  >
>;

export interface ISimpleViewModel<
  T,
  Options extends SimpleViewModelOptions = {},
> extends IViewModel<
  T,
  {
    [K in keyof T]-?: SimpleViewModelAttribute<T[K], Options> & {
      uniqueKey(): K;
      required(): {} extends Pick<T, K> ? false : true;
    };
  } & {
    "~meta": undefined;
  },
  []
> {
  Model: new () => T;
}

const ajv = new Ajv2020({ strict: false });

function isBooleanCompatible(propSchema: Record<string, unknown>): boolean {
  try {
    const validate = ajv.compile(propSchema);
    return validate(true);
  } catch {
    return false;
  }
}

function extractObjectSchema(
  propSchema: Record<string, unknown>,
): Record<string, unknown> | null {
  if (propSchema.type === "object") {
    return propSchema;
  }
  if (Array.isArray(propSchema.anyOf)) {
    const objectBranches = propSchema.anyOf.filter(
      (s: any) => s && typeof s === "object" && s.type === "object",
    );
    if (objectBranches.length === 1) {
      return objectBranches[0] as Record<string, unknown>;
    }
  }
  return null;
}

function createSimpleViewModelFromJsonSchema(
  jsonSchema: Record<string, unknown>,
  options: SimpleViewModelOptions,
): ISimpleViewModel<any, any> {
  const Ctor = class SimpleViewModel {};
  const vm = new RuntimeViewModel<any, any, []>(Ctor);
  const helper = new AttributeDefHelper(vm);
  const defResult: Record<string, any> = {};
  for (const key of Object.keys(jsonSchema.properties ?? {})) {
    const propSchema = (jsonSchema.properties as Record<string, unknown>)[key];
    if (!propSchema) {
      continue;
    }
    defResult[key] = registerAttribute(
      helper,
      key,
      propSchema as Record<string, unknown>,
      options,
    );
  }
  helper["~assignActions"](defResult);
  const ViewModel = createViewModelClass(vm);
  Object.defineProperty(ViewModel, "Model", {
    value: Ctor,
    writable: false,
    enumerable: true,
    configurable: true,
  });
  return ViewModel as ISimpleViewModel<any, any>;
}

function registerAttribute(
  helper: AttributeDefHelper<any>,
  key: string,
  propSchema: Record<string, unknown>,
  options: SimpleViewModelOptions,
): unknown {
  let objectSchema: Record<string, unknown> | null = null;
  if (options.recursive && (objectSchema = extractObjectSchema(propSchema))) {
    const subVM: IViewModel<any, any, []> = createSimpleViewModelFromJsonSchema(
      objectSchema,
      options,
    );
    return helper.attribute((model, positionals, named) => {
      if (positionals.length > 0) {
        model[key] = positionals[0];
      } else {
        model[key] = subVM.parse(named);
      }
    });
  }

  if (options.booleanSwitch && isBooleanCompatible(propSchema)) {
    return helper.simpleAttribute()(function (this: any, ...args: any[]) {
      this[key] = args.length > 0 ? args[0] : true;
    });
  }

  return helper.simpleAttribute()(function (this: any, value) {
    this[key] = value;
  });
}

export function defineSimpleViewModel<
  const T extends StandardJSONSchemaV1,
  const Options extends SimpleViewModelOptions = {},
>(
  schema: T,
  options?: Options,
): ISimpleViewModel<StandardJSONSchemaV1.InferInput<T>, Options> {
  const resolvedOptions: SimpleViewModelOptions = {
    booleanSwitch: false,
    recursive: false,
    ...options,
  };
  const jsonSchema = schema["~standard"].jsonSchema.input({
    target: "draft-2020-12",
  });
  return createSimpleViewModelFromJsonSchema(
    jsonSchema,
    resolvedOptions,
  ) as ISimpleViewModel<StandardJSONSchemaV1.InferInput<T>, Options>;
}
