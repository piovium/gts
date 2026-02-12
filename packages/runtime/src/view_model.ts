import { Action, AllSymbols, Meta, NamedDefinition } from "./symbols";
import { View } from "./view";

export interface AttributeBlockDefinition {
  [name: string]: AttributeDefinition;
  [Action]?: AttributeDefinition;
  [Meta]: any;
}

type Computed<T> = T extends infer U extends { [K in keyof T]: unknown }
  ? U
  : never;

type BlockDefinitionRewriteMeta<
  BlockDef extends AttributeBlockDefinition,
  NewMeta,
> =
  Computed<Omit<BlockDef, Meta> & { [Meta]: NewMeta }> extends infer R extends
    AttributeBlockDefinition
    ? R
    : never;

export interface IViewModel<ModelT, BlockDef extends AttributeBlockDefinition> {
  parse(view: View<BlockDefinitionRewriteMeta<BlockDef, unknown>>): ModelT;
}

export interface ViewModel<ModelT, BlockDef extends AttributeBlockDefinition> {
  /**
   * Helper for fetching symbol types
   * @internal
   */
  "~symbols": AllSymbols;
  [NamedDefinition]: BlockDef;
}

type LazyAttributeActionOrBinder<ModelT> = (
  model: ModelT,
  positionals: () => unknown[],
  named: View<any>,
) => unknown;

export class ViewModel<
  ModelT,
  BlockDef extends AttributeBlockDefinition,
> implements IViewModel<ModelT, BlockDef> {
  #registeredActions: Map<PropertyKey, LazyAttributeActionOrBinder<ModelT>> =
    new Map();
  #registeredBinders: Map<PropertyKey, LazyAttributeActionOrBinder<ModelT>> =
    new Map();

  constructor(private Ctor: new () => ModelT) {}

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

  parse(view: View<BlockDefinitionRewriteMeta<BlockDef, unknown>>): ModelT {
    const model = new this.Ctor();
    for (const attrNode of view._node.attributes) {
      let { name, positionals, named, binding } = attrNode;
      const insideBindingCtx = !!view._bindingCtx;
      let fn = (
        insideBindingCtx ? this.#registeredBinders : this.#registeredActions
      ).get(name);
      if (!insideBindingCtx && !fn) {
        const modelName = this.Ctor.name;
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

class AttributeDefHelper<ModelT> {
  #viewModel: ViewModel<ModelT, any>;
  constructor(viewModel: ViewModel<ModelT, any>) {
    this.#viewModel = viewModel;
  }

  static readonly #lazyActionSlot: unique symbol = Symbol("actionSlot");
  static readonly #lazyBinderSlot: unique symbol = Symbol("binderSlot");

  "~assignActions"(defResult: Record<string | Action, unknown>): void {
    const keys: (string | Action)[] = Object.keys(defResult);
    if (defResult[Action]) {
      keys.push(Action);
    }
    for (const name of keys) {
      const value = defResult[name]!;
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
      | ViewModel<any, ReturnType<T>["namedDefinition"]>,
  ): T;
  attribute<T extends AttributeDefinition>(
    action: AttributeAction<ModelT, T>,
    binder: AttributeBinder<ModelT, T>,
  ): T;
  attribute(
    action: any,
    binder?: AttributeBinder<any, any> | ViewModel<any, any>,
  ) {
    const returnValue = {};
    const lazyAction: LazyAttributeActionOrBinder<ModelT> = (
      model,
      positionals,
      named,
    ) => action(model, positionals, named);
    Object.defineProperty(returnValue, AttributeDefHelper.#lazyActionSlot, {
      value: lazyAction,
      enumerable: true,
    });
    let lazyBinder: LazyAttributeActionOrBinder<ModelT>;
    if (binder instanceof ViewModel) {
      const vm = binder;
      lazyBinder = (model, positionals, named) => {
        return vm.parse(named);
      };
    } else if (binder) {
      lazyBinder = (model, positionals, named) =>
        binder(model, positionals(), named);
    } else {
      lazyBinder = () => {};
    }
    Object.defineProperty(returnValue, AttributeDefHelper.#lazyBinderSlot, {
      value: lazyBinder,
      enumerable: true,
    });
    return returnValue;
  }

  simpleAttribute<Args extends any[]>(
    action: (this: ModelT, ...args: Args) => void,
  ): {
    (...args: Args): AttributeReturn.Done;
  };
  simpleAttribute<Args extends any[], U>(
    action: (this: ModelT, ...args: Args) => void,
    binder: (this: ModelT, ...args: Args) => U,
  ): {
    (...args: Args): AttributeReturn.Done;
    as?(): U;
  };
  simpleAttribute<Args extends any[], U>(
    action: (this: ModelT, ...args: Args) => void,
    binder?: (this: ModelT, ...args: Args) => U,
  ) {
    const action2: AttributeAction<ModelT, any> = (model, positionals) =>
      action.apply(model, positionals as Args);
    let binder2: AttributeBinder<ModelT, any> | undefined;
    if (binder) {
      binder2 = (model, positionals) =>
        binder.apply(model, positionals as Args);
    }
    return this.attribute<any>(action2, binder2);
  }
}

export function defineViewModel<
  T,
  const BlockDef extends Record<string | Action, AttributeDefinition>,
  InitMeta = void,
>(
  Ctor: new () => T,
  modelDefFn: (helper: AttributeDefHelper<T>) => BlockDef,
  initMeta?: InitMeta,
): ViewModel<T, BlockDef & { [Meta]: InitMeta }> {
  const vm = new ViewModel<T, BlockDef & { [Meta]: InitMeta }>(Ctor);
  const helper = new AttributeDefHelper(vm);
  const defResult = modelDefFn(helper);
  helper["~assignActions"](defResult);
  return vm;
}

interface AttributeDefinition {
  (...args: any[]): AttributePositionalReturnBase;
  as?(): any;
  // required?(): boolean;
}

interface AttributePositionalReturnBase {
  rewriteMeta?: any;
  namedDefinition: AttributeBlockDefinition;
}

export namespace AttributeReturn {
  export type This<TMeta = any> = {
    [Meta]: TMeta;
  };

  export type EnableIf<Condition, T = void> = Condition extends true
    ? T
    : never;

  export type Done = {
    namedDefinition: { [Meta]: void };
  };

  export type With<
    VM extends ViewModel<any, any>,
    TMeta = VM[NamedDefinition][Meta],
  > = {
    namedDefinition: BlockDefinitionRewriteMeta<VM[NamedDefinition], TMeta>;
  };

  export type WithRewriteMeta<VM extends ViewModel<any, any>, NewMeta> = {
    namedDefinition: VM[NamedDefinition];
    rewriteMeta: NewMeta;
  };
}

export type { AttributeReturn as AR };

export type AttributeAction<Model, T extends AttributeDefinition> = (
  model: Model,
  positional: Parameters<T>,
  named: View<
    ReturnType<T>["namedDefinition"] extends AttributeBlockDefinition
      ? ReturnType<T>["namedDefinition"]
      : { [Meta]: void }
  >,
) => void;

export type AttributeBinder<Model, T extends AttributeDefinition> = (
  model: Model,
  positional: Parameters<T>,
  named: View<
    ReturnType<T>["namedDefinition"] extends AttributeBlockDefinition
      ? ReturnType<T>["namedDefinition"]
      : { [Meta]: void }
  >,
) => T["as"] extends () => infer U ? U : void;
