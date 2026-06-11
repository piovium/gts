import type { AttributeReturn } from "./attribute_return.ts";
import type { Action, Meta, NamedDefinition } from "./symbols.ts";
import { View } from "./view.ts";
import type { StandardJSONSchemaV1 } from "@standard-schema/spec";

export interface AttributeBlockDefinition {
  "~action"?: AttributeDefinition | undefined;
  "~meta": any;
}

type Computed<T> = T extends infer U extends { [K in keyof T]: unknown }
  ? U
  : never;

export type BlockDefinitionRewriteMeta<
  BlockDef extends AttributeBlockDefinition,
  NewMeta,
> =
  Computed<Omit<BlockDef, Meta> & { "~meta": NewMeta }> extends infer R extends
    AttributeBlockDefinition
    ? R
    : never;

export interface IViewModel<
  ModelT,
  BlockDef extends AttributeBlockDefinition,
  CtorArgs extends any[],
> {
  parse(
    view: View<BlockDefinitionRewriteMeta<BlockDef, unknown>>,
    ...args: CtorArgs
  ): ModelT;
  "~namedDefinition": BlockDef;
}

type LazyAttributeActionOrBinder<ModelT> = (
  model: ModelT,
  positionals: () => unknown[],
  named: View<any>,
) => unknown;

class ViewModel<
  ModelT,
  BlockDef extends AttributeBlockDefinition,
  CtorArgs extends any[],
> implements IViewModel<ModelT, BlockDef, CtorArgs> {
  declare "~namedDefinition": BlockDef;

  #registeredActions: Map<PropertyKey, LazyAttributeActionOrBinder<ModelT>> =
    new Map();
  #registeredBinders: Map<PropertyKey, LazyAttributeActionOrBinder<ModelT>> =
    new Map();

  #Ctor: new (...args: CtorArgs) => ModelT;

  constructor(Ctor: new (...args: CtorArgs) => ModelT) {
    this.#Ctor = Ctor;
  }

  "~setActionOrBinder"(
    context: "action" | "binder",
    name: PropertyKey,
    action: LazyAttributeActionOrBinder<ModelT>,
  ): void {
    if (context === "action") {
      this.#registeredActions.set(name, action);
    } else {
      this.#registeredBinders.set(name, action);
    }
  }

  parse(
    view: View<BlockDefinitionRewriteMeta<BlockDef, unknown>>,
    ...args: CtorArgs
  ): ModelT {
    const model = new this.#Ctor(...args);
    for (const attrNode of view._node.attributes) {
      let { name, positionals, named, binding } = attrNode;
      const insideBindingCtx = !!view._bindingCtx;
      let fn = (
        insideBindingCtx ? this.#registeredBinders : this.#registeredActions
      ).get(name);
      if (!insideBindingCtx && !fn) {
        const modelName = this.#Ctor.name;
        throw new Error(
          `No action registered for attribute "${String(name)}" on model "${modelName}"`,
        );
      }
      fn ??= () => {};
      named ??= { attributes: [] };
      const value = fn(model, positionals, new View(named, view._bindingCtx));
      if (binding && view._bindingCtx) {
        view._bindingCtx.addBinding(value);
      }
    }
    return model;
  }
}

interface SimpleAttributeOptions {
  required?: true;
  uniqueKey?: string;
}

type WithSimpleOptions<Base, Options extends SimpleAttributeOptions> = Base &
  (Options["required"] extends true ? { required(): true } : {}) &
  (Options["uniqueKey"] extends string
    ? { uniqueKey(): Options["uniqueKey"] }
    : {});

class AttributeDefHelper<ModelT> {
  #viewModel: ViewModel<ModelT, any, any>;
  constructor(viewModel: ViewModel<ModelT, any, any>) {
    this.#viewModel = viewModel;
  }

  static readonly #lazyActionSlot: unique symbol = Symbol("actionSlot");
  static readonly #lazyBinderSlot: unique symbol = Symbol("binderSlot");

  "~assignActions"(defResult: Partial<Record<string, unknown>>): void {
    for (const [name, value] of Object.entries(defResult)) {
      if (!value) {
        // @ts-expect-error no typing for console
        console?.warn?.(
          `Attribute "${name}" is assigned a falsy value, which is not a valid attribute definition.`,
        );
        continue;
      }
      const actionDescriptor = Object.getOwnPropertyDescriptor(
        value,
        AttributeDefHelper.#lazyActionSlot,
      );
      if (actionDescriptor) {
        this.#viewModel["~setActionOrBinder"](
          "action",
          name,
          actionDescriptor.value,
        );
      }
      const binderDescriptor = Object.getOwnPropertyDescriptor(
        value,
        AttributeDefHelper.#lazyBinderSlot,
      );
      if (binderDescriptor) {
        this.#viewModel["~setActionOrBinder"](
          "binder",
          name,
          binderDescriptor.value,
        );
      }
    }
  }

  attribute<T extends AttributeDefinition & { as?: undefined }>(
    action: AttributeAction<ModelT, T>,
    binder?:
      | AttributeBinder<ModelT, T>
      | IViewModel<any, ReturnType<T>["namedDefinition"], []>,
  ): T;
  attribute<T extends AttributeDefinition>(
    action: AttributeAction<ModelT, T>,
    binder: AttributeBinder<ModelT, T>,
  ): T;
  attribute(
    action: any,
    binder?: AttributeBinder<any, any> | IViewModel<any, any, any>,
  ) {
    const returnValue = {};
    const lazyAction: LazyAttributeActionOrBinder<ModelT> = (
      model,
      positionals,
      named,
    ) => action(model, positionals(), named);
    Object.defineProperty(returnValue, AttributeDefHelper.#lazyActionSlot, {
      value: lazyAction,
      enumerable: true,
    });
    let lazyBinder: LazyAttributeActionOrBinder<ModelT>;
    if (typeof binder === "function") {
      lazyBinder = (model, positionals, named) =>
        binder(model, positionals(), named);
    } else if (binder) {
      const vm = binder;
      lazyBinder = (model, positionals, named) => {
        return vm.parse(named);
      };
    } else {
      lazyBinder = () => {};
    }
    Object.defineProperty(returnValue, AttributeDefHelper.#lazyBinderSlot, {
      value: lazyBinder,
      enumerable: true,
    });
    return returnValue;
  }

  simpleAttribute(): {
    <Args extends any[]>(
      action: (this: ModelT, ...args: Args) => void,
    ): { (...args: Args): AttributeReturn.Done };
    <Args extends any[], U>(
      action: (this: ModelT, ...args: Args) => void,
      binder: (this: ModelT, ...args: Args) => U,
    ): { (...args: Args): AttributeReturn.Done; as(): U };
  };
  simpleAttribute<const Options extends SimpleAttributeOptions>(
    options: Options,
  ): {
    <Args extends any[]>(
      action: (this: ModelT, ...args: Args) => void,
    ): WithSimpleOptions<{ (...args: Args): AttributeReturn.Done }, Options>;
    <Args extends any[], U>(
      action: (this: ModelT, ...args: Args) => void,
      binder: (this: ModelT, ...args: Args) => U,
    ): WithSimpleOptions<
      { (...args: Args): AttributeReturn.Done; as(): U },
      Options
    >;
  };
  simpleAttribute(options?: SimpleAttributeOptions) {
    return (
      action: (this: ModelT, ...args: any[]) => void,
      binder?: (this: ModelT, ...args: any[]) => any,
    ) => {
      const action2: AttributeAction<ModelT, any> = (model, positionals) =>
        action.apply(model, positionals);
      let binder2: AttributeBinder<ModelT, any> | undefined;
      if (binder) {
        binder2 = (model, positionals) => binder.apply(model, positionals);
      }
      return this.attribute<any>(action2, binder2);
    };
  }
}

export function defineViewModel<
  T,
  const BlockDef extends Partial<Record<string | Action, AttributeDefinition>>,
  CtorArgs extends any[] = [],
  InitMeta = void,
>(
  Ctor: new (...args: CtorArgs) => T,
  modelDefFn: (helper: AttributeDefHelper<T>) => BlockDef,
  initMeta?: InitMeta,
): IViewModel<T, BlockDef & { "~meta": InitMeta }, CtorArgs> {
  const vm = new ViewModel<T, BlockDef & { "~meta": InitMeta }, CtorArgs>(Ctor);
  const helper = new AttributeDefHelper(vm);
  const defResult = modelDefFn(helper);
  helper["~assignActions"](defResult);
  return vm;
}

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
  return vm;
}

export interface AttributeDefinition {
  (...args: any[]): AttributePositionalReturnBase;
  as?(): any;
  required?(): boolean;
  uniqueKey?(): string;
}

interface AttributePositionalReturnBase {
  rewriteMeta?: any;
  namedDefinition: AttributeBlockDefinition;
}

export type AttributeAction<Model, T extends AttributeDefinition> = (
  model: Model,
  positional: Parameters<T>,
  named: View<
    ReturnType<T>["namedDefinition"] extends AttributeBlockDefinition
      ? ReturnType<T>["namedDefinition"]
      : { "~meta": void }
  >,
) => void;

export type AttributeBinder<Model, T extends AttributeDefinition> = (
  model: Model,
  positional: Parameters<T>,
  named: View<
    ReturnType<T>["namedDefinition"] extends AttributeBlockDefinition
      ? ReturnType<T>["namedDefinition"]
      : { "~meta": void }
  >,
) => T["as"] extends () => infer U ? U : void;
