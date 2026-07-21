import type {
  AttributePositionalReturnBase,
  AttributeReturn,
  Computed,
} from "./attribute_return.ts";
import type { Action, Meta } from "./symbols.ts";
import { View } from "./view.ts";

export interface AttributeBlockDefinition {
  "~meta": any;
}

export type BlockDefinitionRewriteMeta<
  BlockDef extends AttributeBlockDefinition,
  NewMeta,
> = Computed<
  Omit<BlockDef, Meta> & { "~meta": NewMeta },
  AttributeBlockDefinition
>;

export interface IViewModel<
  ModelT,
  BlockDef extends AttributeBlockDefinition,
  CtorArgs extends any[],
> {
  "~modelType": ModelT;
  "~ctorArgs": CtorArgs;
  "~namedDefinition": BlockDef;
}

export interface ViewModelClass<
  ModelT,
  BlockDef extends AttributeBlockDefinition,
  CtorArgs extends any[],
> {
  new (): IViewModel<ModelT, BlockDef, CtorArgs>;
  parse(
    view: View<BlockDefinitionRewriteMeta<BlockDef, unknown>>,
    ...args: CtorArgs
  ): ModelT;
  /**
   * Creates a new ViewModel with the same actions and binders, but with
   * - a different constructor that accepts the specified arguments, and/or
   * - a different initial Meta.
   *
   * This is useful for creating binding ViewModels directly that forwards
   * the binding logic to inner ViewModels.
   */
  bind<NewMeta = BlockDef[Meta]>(): ViewModelClass<
    ModelT,
    BlockDefinitionRewriteMeta<BlockDef, NewMeta>,
    CtorArgs
  >;
  bind<NewMeta = BlockDef[Meta]>(
    ...args: CtorArgs
  ): ViewModelClass<ModelT, BlockDefinitionRewriteMeta<BlockDef, NewMeta>, []>;
  extend<
    ChildT extends ModelT,
    const ChildBlockDef extends Partial<
      Record<string | Action, AttributeDefinition>
    >,
    ChildCtorArgs extends any[] = [],
  >(
    Ctor: new (...args: ChildCtorArgs) => ChildT,
    modelDefFn: (helper: AttributeDefHelper<ChildT>) => ChildBlockDef,
  ): ViewModelClass<
    ChildT,
    Computed<
      Omit<BlockDef, keyof ChildBlockDef> &
        ChildBlockDef & { "~meta": BlockDef[Meta] }
    >,
    ChildCtorArgs
  >;
}

type LazyAttributeActionOrBinder<ModelT> = (
  model: ModelT,
  positionals: () => unknown[],
  named: View<any>,
) => unknown;

let currentContext: "action" | "binder" | null = null;
export function getCurrentContext(): "action" | "binder" | null {
  return currentContext;
}

export class RuntimeViewModel<
  ModelT,
  BlockDef extends AttributeBlockDefinition,
  CtorArgs extends any[],
> {
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
    currentContext = view._bindingCtx ? "binder" : "action";
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
    currentContext = null;
    return model;
  }

  #clone() {
    const newVM = new RuntimeViewModel(this.#Ctor);
    newVM.#registeredActions = new Map(this.#registeredActions);
    newVM.#registeredBinders = new Map(this.#registeredBinders);
    return newVM;
  }

  bind<NewMeta = BlockDef[Meta]>(): RuntimeViewModel<
    ModelT,
    BlockDefinitionRewriteMeta<BlockDef, NewMeta>,
    CtorArgs
  >;
  bind<NewMeta = BlockDef[Meta]>(
    ...args: CtorArgs
  ): RuntimeViewModel<
    ModelT,
    BlockDefinitionRewriteMeta<BlockDef, NewMeta>,
    []
  >;
  bind<NewMeta = BlockDef[Meta]>(
    ...args: any[]
  ): RuntimeViewModel<
    ModelT,
    BlockDefinitionRewriteMeta<BlockDef, NewMeta>,
    any
  > {
    if (args.length === 0) {
      return this as any;
    }
    const newModel = this.#clone() as RuntimeViewModel<any, any, any>;
    newModel.#Ctor = class extends (this.#Ctor as new (...args: any[]) => any) {
      constructor() {
        super(...args);
      }
    };
    return newModel as RuntimeViewModel<any, any, any>;
  }

  extend<
    ChildT extends ModelT,
    const ChildBlockDef extends Partial<
      Record<string | Action, AttributeDefinition>
    >,
    ChildCtorArgs extends any[] = [],
  >(
    Ctor: new (...args: ChildCtorArgs) => ChildT,
    modelDefFn: (helper: AttributeDefHelper<ChildT>) => ChildBlockDef,
  ): RuntimeViewModel<
    ChildT,
    Computed<
      Omit<BlockDef, keyof ChildBlockDef> &
        ChildBlockDef & { "~meta": BlockDef[Meta] }
    >,
    ChildCtorArgs
  > {
    const newVM = new RuntimeViewModel<ChildT, any, ChildCtorArgs>(Ctor);
    for (const [name, action] of this.#registeredActions) {
      newVM["~setActionOrBinder"]("action", name, action as any);
    }
    for (const [name, binder] of this.#registeredBinders) {
      newVM["~setActionOrBinder"]("binder", name, binder as any);
    }
    const helper = new AttributeDefHelper(newVM);
    const defResult = modelDefFn(helper);
    helper["~assignActions"](defResult);
    return newVM as any;
  }
}

const runtimeViewModelSlot: unique symbol = Symbol("runtimeViewModel");

function isViewModelClass(
  value: unknown,
): value is ViewModelClass<any, any, any> {
  return typeof value === "function" && runtimeViewModelSlot in value;
}

export function createViewModelClass<
  ModelT,
  BlockDef extends AttributeBlockDefinition,
  CtorArgs extends any[],
>(
  viewModel: RuntimeViewModel<ModelT, BlockDef, CtorArgs>,
): ViewModelClass<ModelT, BlockDef, CtorArgs> {
  class ViewModelDescriptor {
    declare "~modelType": ModelT;
    declare "~ctorArgs": CtorArgs;
    declare "~namedDefinition": BlockDef;

    static readonly [runtimeViewModelSlot] = viewModel;

    static parse(
      view: View<BlockDefinitionRewriteMeta<BlockDef, unknown>>,
      ...args: CtorArgs
    ): ModelT {
      return viewModel.parse(view, ...args);
    }

    static bind<NewMeta = BlockDef[Meta]>(): ViewModelClass<
      ModelT,
      BlockDefinitionRewriteMeta<BlockDef, NewMeta>,
      CtorArgs
    >;
    static bind<NewMeta = BlockDef[Meta]>(
      ...args: CtorArgs
    ): ViewModelClass<
      ModelT,
      BlockDefinitionRewriteMeta<BlockDef, NewMeta>,
      []
    >;
    static bind<NewMeta = BlockDef[Meta]>(
      ...args: CtorArgs
    ): ViewModelClass<
      ModelT,
      BlockDefinitionRewriteMeta<BlockDef, NewMeta>,
      any
    > {
      const boundViewModel =
        args.length === 0
          ? viewModel.bind<NewMeta>()
          : viewModel.bind<NewMeta>(...args);
      return createViewModelClass(
        boundViewModel as RuntimeViewModel<ModelT, any, any>,
      );
    }

    static extend<
      ChildT extends ModelT,
      const ChildBlockDef extends Partial<
        Record<string | Action, AttributeDefinition>
      >,
      ChildCtorArgs extends any[] = [],
    >(
      Ctor: new (...args: ChildCtorArgs) => ChildT,
      modelDefFn: (helper: AttributeDefHelper<ChildT>) => ChildBlockDef,
    ): ViewModelClass<
      ChildT,
      Computed<
        Omit<BlockDef, keyof ChildBlockDef> &
          ChildBlockDef & { "~meta": BlockDef[Meta] }
      >,
      ChildCtorArgs
    > {
      return createViewModelClass(viewModel.extend(Ctor, modelDefFn));
    }
  }

  return ViewModelDescriptor;
}

export interface SimpleAttributeOptions {
  required?: true;
  uniqueKey?: string;
}

type WithSimpleOptions<Base, Options extends SimpleAttributeOptions> = Base &
  (Options["required"] extends true ? { required(): true } : {}) &
  (Options["uniqueKey"] extends string
    ? { uniqueKey(): Options["uniqueKey"] }
    : {});

export class AttributeDefHelper<ModelT> {
  #viewModel: RuntimeViewModel<ModelT, any, any>;
  constructor(viewModel: RuntimeViewModel<ModelT, any, any>) {
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
      | ViewModelClass<any, ReturnType<T>["namedDefinition"], []>,
  ): T;
  attribute<T extends AttributeDefinition>(
    action: AttributeAction<ModelT, T>,
    binder: AttributeBinder<ModelT, T>,
  ): T;
  attribute(
    action: any,
    binder?: AttributeBinder<any, any> | ViewModelClass<any, any, any>,
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
    if (isViewModelClass(binder)) {
      const vm = binder;
      lazyBinder = (model, positionals, named) => {
        return vm.parse(named);
      };
    } else if (typeof binder === "function") {
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
): ViewModelClass<T, BlockDef & { "~meta": InitMeta }, CtorArgs> {
  const vm = new RuntimeViewModel<
    T,
    BlockDef & { "~meta": InitMeta },
    CtorArgs
  >(Ctor);
  const helper = new AttributeDefHelper(vm);
  const defResult = modelDefFn(helper);
  helper["~assignActions"](defResult);
  return createViewModelClass(vm);
}

export interface AttributeDefinition {
  (...args: any[]): AttributePositionalReturnBase;
  as?(): any;
  required?(): boolean;
  uniqueKey?(): string;
  mergeMeta?(meta: any, subMeta: any): any;
}

type OverloadedParameters<T extends (...args: any[]) => any> = T extends {
  (...args: infer A1): any;
  (...args: infer A2): any;
  (...args: infer A3): any;
  (...args: infer A4): any;
}
  ? A1 | A2 | A3 | A4
  : T extends {
        (...args: infer A1): any;
        (...args: infer A2): any;
        (...args: infer A3): any;
      }
    ? A1 | A2 | A3
    : T extends { (...args: infer A1): any; (...args: infer A2): any }
      ? A1 | A2
      : T extends (...args: infer A) => any
        ? A
        : never;

export type AttributeAction<Model, T extends AttributeDefinition> = (
  model: Model,
  positional: OverloadedParameters<T>,
  named: View<
    ReturnType<T>["namedDefinition"] extends AttributeBlockDefinition
      ? ReturnType<T>["namedDefinition"]
      : { "~meta": void }
  >,
) => void;

export type AttributeBinder<Model, T extends AttributeDefinition> = (
  model: Model,
  positional: OverloadedParameters<T>,
  named: View<
    ReturnType<T>["namedDefinition"] extends AttributeBlockDefinition
      ? ReturnType<T>["namedDefinition"]
      : { "~meta": void }
  >,
) => T["as"] extends () => infer U ? U : void;
