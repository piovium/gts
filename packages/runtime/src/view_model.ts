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

export interface IViewModelInstance<
  T extends IViewModel<any, any, any> = IViewModel<any, any, any>,
> {
  "~viewModel": T;
}

export interface IViewModel<
  ModelT,
  BlockDef extends AttributeBlockDefinition,
  CtorArgs extends any[],
> {
  "~modelType": ModelT;
  "~ctorArgs": CtorArgs;
  "~namedDefinition": BlockDef;
  new (): IViewModelInstance<this>;
  "~viewModel": this;
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
  bind<NewMeta = BlockDef[Meta]>(): IViewModel<
    ModelT,
    BlockDefinitionRewriteMeta<BlockDef, NewMeta>,
    CtorArgs
  >;
  bind<NewMeta = BlockDef[Meta]>(
    ...args: CtorArgs
  ): IViewModel<ModelT, BlockDefinitionRewriteMeta<BlockDef, NewMeta>, []>;
  extend<
    ChildT extends ModelT,
    const ChildBlockDef extends Partial<
      Record<string | Action, AttributeDefinition>
    >,
    ChildCtorArgs extends any[] = [],
  >(
    Ctor: new (...args: ChildCtorArgs) => ChildT,
    modelDefFn: (helper: AttributeDefHelper<ChildT>) => ChildBlockDef,
  ): IViewModel<
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

export class ViewModelRuntime {
  #registeredActions = new Map<PropertyKey, LazyAttributeActionOrBinder<any>>();
  #registeredBinders = new Map<PropertyKey, LazyAttributeActionOrBinder<any>>();
  #Ctor: new (...args: any[]) => any;

  constructor(Ctor: new (...args: any[]) => any) {
    this.#Ctor = Ctor;
  }

  setActionOrBinder(
    context: "action" | "binder",
    name: PropertyKey,
    action: LazyAttributeActionOrBinder<any>,
  ): void {
    if (context === "action") {
      this.#registeredActions.set(name, action);
    } else {
      this.#registeredBinders.set(name, action);
    }
  }

  parse(view: View<any>, ...args: any[]): any {
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

  #clone(Ctor = this.#Ctor): ViewModelRuntime {
    const newVMR = new ViewModelRuntime(Ctor);
    newVMR.#registeredActions = new Map(this.#registeredActions);
    newVMR.#registeredBinders = new Map(this.#registeredBinders);
    return newVMR;
  }

  bind(...args: any[]): ViewModelRuntime {
    const ParentCtor = this.#Ctor;
    class RebindedCtor extends ParentCtor {
      constructor() {
        super(...args);
      }
    }
    return this.#clone(RebindedCtor);
  }

  extend(
    ChildCtor: new (...args: any[]) => any,
    modelDefFn: (helper: AttributeDefHelper<any>) => any,
  ): ViewModelRuntime {
    const newVMR = this.#clone(ChildCtor);
    const helper = new AttributeDefHelper(newVMR);
    const defResult = modelDefFn(helper);
    helper["~assignActions"](defResult);
    return newVMR;
  }
}

const runtimeViewModelSlot: unique symbol = Symbol("runtimeViewModel");

function isViewModel(value: unknown): value is IViewModel<any, any, any> {
  return typeof value === "function" && runtimeViewModelSlot in value;
}

export function createViewModel<
  ModelT,
  BlockDef extends AttributeBlockDefinition,
  CtorArgs extends any[],
>(vmr: ViewModelRuntime): IViewModel<ModelT, BlockDef, CtorArgs> {
  class ViewModelDescriptor implements IViewModelInstance {
    declare static "~modelType": ModelT;
    declare static "~ctorArgs": CtorArgs;
    declare static "~namedDefinition": BlockDef;

    static readonly [runtimeViewModelSlot] = vmr;

    static parse(
      view: View<BlockDefinitionRewriteMeta<BlockDef, unknown>>,
      ...args: CtorArgs
    ): ModelT {
      return vmr.parse(view, ...args);
    }

    static bind<NewMeta = BlockDef[Meta]>(): IViewModel<
      ModelT,
      BlockDefinitionRewriteMeta<BlockDef, NewMeta>,
      CtorArgs
    >;
    static bind<NewMeta = BlockDef[Meta]>(
      ...args: CtorArgs
    ): IViewModel<ModelT, BlockDefinitionRewriteMeta<BlockDef, NewMeta>, []>;
    static bind<NewMeta = BlockDef[Meta]>(
      ...args: CtorArgs
    ): IViewModel<ModelT, BlockDefinitionRewriteMeta<BlockDef, NewMeta>, any> {
      if (args.length === 0) {
        return this as any;
      }
      return createViewModel(vmr.bind(...args));
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
    ): IViewModel<
      ChildT,
      Computed<
        Omit<BlockDef, keyof ChildBlockDef> &
          ChildBlockDef & { "~meta": BlockDef[Meta] }
      >,
      ChildCtorArgs
    > {
      return createViewModel(vmr.extend(Ctor, modelDefFn));
    }

    declare "~viewModel": typeof ViewModelDescriptor;
    declare static "~viewModel": typeof ViewModelDescriptor;
  }

  return ViewModelDescriptor as IViewModel<ModelT, BlockDef, CtorArgs>;
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
  #vmr: ViewModelRuntime;
  constructor(vmr: ViewModelRuntime) {
    this.#vmr = vmr;
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
        this.#vmr.setActionOrBinder("action", name, actionDescriptor.value);
      }
      const binderDescriptor = Object.getOwnPropertyDescriptor(
        value,
        AttributeDefHelper.#lazyBinderSlot,
      );
      if (binderDescriptor) {
        this.#vmr.setActionOrBinder("binder", name, binderDescriptor.value);
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
    if (isViewModel(binder)) {
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
): IViewModel<T, BlockDef & { "~meta": InitMeta }, CtorArgs> {
  const vmr = new ViewModelRuntime(Ctor);
  const helper = new AttributeDefHelper<T>(vmr);
  const defResult = modelDefFn(helper);
  helper["~assignActions"](defResult);
  return createViewModel(vmr);
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
