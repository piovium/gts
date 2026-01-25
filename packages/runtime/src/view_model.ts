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

export class ViewModel<
  ModelT,
  BlockDef extends AttributeBlockDefinition,
> implements IViewModel<ModelT, BlockDef> {
  /**
   * Helper for fetching symbol types
   * @internal
   */
  declare _symbols: AllSymbols;

  declare [NamedDefinition]: BlockDef;
  #registeredActions: Map<PropertyKey, AttributeAction<ModelT, any>> =
    new Map();
  #registeredBinders: Map<PropertyKey, AttributeBinder<ModelT, any>> =
    new Map();

  constructor(private Ctor: new () => ModelT) {}

  _setAction(name: PropertyKey, action: AttributeAction<ModelT, any>) {
    this.#registeredActions.set(name, action);
  }
  _setBinder(name: PropertyKey, binder: AttributeBinder<ModelT, any>) {
    this.#registeredBinders.set(name, binder);
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
        console?.warn(`No action registered for attribute: ${String(name)}`);
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

  static readonly #actionSlot: unique symbol = Symbol("actionSlot");
  static readonly #binderSlot: unique symbol = Symbol("binderSlot");

  _assignActions(defResult: Record<string, unknown>) {
    for (const [name, returnValue] of Object.entries(defResult)) {
      const actionDescriptor = Object.getOwnPropertyDescriptor(
        returnValue,
        AttributeDefHelper.#actionSlot,
      );
      if (actionDescriptor) {
        this.#viewModel._setAction(name, actionDescriptor.value);
      }
      const binderDescriptor = Object.getOwnPropertyDescriptor(
        returnValue,
        AttributeDefHelper.#binderSlot,
      );
      if (binderDescriptor) {
        this.#viewModel._setBinder(name, binderDescriptor.value);
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
    if (binder instanceof ViewModel) {
      const vm = binder;
      binder = (model, positionals, named) => {
        return vm.parse(named);
      };
    }
    binder ??= () => {};
    const returnValue = {};
    Object.defineProperty(returnValue, AttributeDefHelper.#actionSlot, {
      value: action,
      enumerable: true,
    });
    Object.defineProperty(returnValue, AttributeDefHelper.#binderSlot, {
      value: binder,
      enumerable: true,
    });
    return returnValue;
  }
}

export function defineViewModel<
  T,
  const BlockDef extends Record<string, AttributeDefinition>,
  InitMeta = void,
>(
  Ctor: new () => T,
  modelDefFn: (helper: AttributeDefHelper<T>) => BlockDef,
  initMeta?: InitMeta,
): ViewModel<T, BlockDef & { [Meta]: InitMeta }> {
  const vm = new ViewModel<T, BlockDef & { [Meta]: InitMeta }>(Ctor);
  const helper = new AttributeDefHelper(vm);
  const defResult = modelDefFn(helper);
  helper._assignActions(defResult);
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

  export type Done = {
    namedDefinition: { [Meta]: void };
  };

  export type With<
    VM extends ViewModel<any, any>,
    TMeta = VM[NamedDefinition][Meta],
  > = {
    namedDefinition: BlockDefinitionRewriteMeta<VM[NamedDefinition], TMeta>;
  };

  export type WithRewriteMeta<VM extends ViewModel<any, any>, Meta> = {
    namedDefinition: VM[NamedDefinition];
    rewriteMeta: Meta;
  };
}

export type AttributeAction<Model, T extends AttributeDefinition> = (
  model: Model,
  positional: () => Parameters<T>,
  named: View<
    ReturnType<T>["namedDefinition"] extends AttributeBlockDefinition
      ? ReturnType<T>["namedDefinition"]
      : { [Meta]: void }
  >,
) => void;

export type AttributeBinder<Model, T extends AttributeDefinition> = (
  model: Model,
  positional: () => Parameters<T>,
  named: View<
    ReturnType<T>["namedDefinition"] extends AttributeBlockDefinition
      ? ReturnType<T>["namedDefinition"]
      : { [Meta]: void }
  >,
) => T["as"] extends () => infer U ? U : void;
