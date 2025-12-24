import { View } from "./view";

export interface AttributeBlockDefinition {
  [name: string]: AttributeDefinition;
  [ActionSymbol]?: AttributeDefinition;
  [MetaSymbol]: any;
}

type Computed<T> = T extends infer U extends { [K in keyof T]: unknown }
  ? U
  : never;

type BlockDefinitionRewriteMeta<
  BlockDef extends AttributeBlockDefinition,
  NewMeta,
> = Computed<
  Omit<BlockDef, MetaSymbol> & { [MetaSymbol]: NewMeta }
> extends infer R extends AttributeBlockDefinition
  ? R
  : never;

const NamedDefinition: unique symbol = Symbol("NamedDefinition");
type NamedDefinition = typeof NamedDefinition;

export interface IViewModel<ModelT, BlockDef extends AttributeBlockDefinition> {
  parse(view: View<BlockDefinitionRewriteMeta<BlockDef, unknown>>): ModelT;
}

class ViewModel<ModelT, BlockDef extends AttributeBlockDefinition>
  implements IViewModel<ModelT, BlockDef>
{
  declare [NamedDefinition]: BlockDef;
  #registeredActions: Map<string, AttributeAction<ModelT, any, any>> =
    new Map();

  constructor(private Ctor: new () => ModelT) {}

  _setAction(name: string, action: AttributeAction<ModelT, any, any>) {
    this.#registeredActions.set(name, action);
  }

  parse(view: View<BlockDefinitionRewriteMeta<BlockDef, unknown>>): ModelT {
    const model = new this.Ctor();
    for (const attrFactory of view._node.attributes) {
      let { name, positionals, named, binding } = attrFactory();
      const action = this.#registeredActions.get(name);
      if (!action) {
        throw new Error(`No action registered for attribute: ${name}`);
      }
      named ??= { attributes: [] };
      const value = action(
        model,
        positionals,
        new View(named, view._addBinding),
      );
      if (binding) {
        view._addBinding({
          ...binding,
          value,
        });
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

  _assignActions(defResult: Record<string, unknown>) {
    for (const [name, returnValue] of Object.entries(defResult)) {
      const desc = Object.getOwnPropertyDescriptor(
        returnValue,
        AttributeDefHelper.#actionSlot,
      );
      if (desc) {
        this.#viewModel._setAction(name, desc.value);
      }
    }
  }

  attribute<T extends AttributeDefinition>(
    action: AttributeAction<
      ModelT,
      T,
      T["as"] extends () => infer R ? R : void
    >,
  ): T {
    const returnValue = {} as T;
    Object.defineProperty(returnValue, AttributeDefHelper.#actionSlot, {
      value: action,
    });
    return {} as T;
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
): ViewModel<T, BlockDef & { [MetaSymbol]: InitMeta }> {
  const vm = new ViewModel<T, BlockDef & { [MetaSymbol]: InitMeta }>(Ctor);
  const helper = new AttributeDefHelper(vm);
  const defResult = modelDefFn(helper);
  helper._assignActions(defResult);
  return vm;
}

interface AttributeDefinition {
  (...args: any[]): AttributePositionalReturnBase;
  as?(): any;
  required?(): boolean;
}

interface AttributePositionalReturnBase {
  rewriteMeta?: any;
  namedDefinition: AttributeBlockDefinition;
}

const MetaSymbol: unique symbol = Symbol("Meta");
type MetaSymbol = typeof MetaSymbol;

export const ActionSymbol: unique symbol = Symbol("Action");
export type ActionSymbol = typeof ActionSymbol;

export namespace AttributeReturn {
  export type This<Meta = any> = {
    [MetaSymbol]: Meta;
  };

  export type Done = {
    namedDefinition: { [MetaSymbol]: void };
  };

  export type With<
    VM extends ViewModel<any, any>,
    Meta = VM[NamedDefinition][MetaSymbol],
  > = {
    namedDefinition: BlockDefinitionRewriteMeta<VM[NamedDefinition], Meta>;
  };

  export type WithRewriteMeta<VM extends ViewModel<any, any>, Meta> = {
    namedDefinition: VM[NamedDefinition];
    rewriteMeta: Meta;
  };
}

export type AttributeAction<Model, T extends AttributeDefinition, BindingT> = (
  model: Model,
  positional: Parameters<T>,
  named: View<
    ReturnType<T>["namedDefinition"] extends AttributeBlockDefinition
      ? ReturnType<T>["namedDefinition"]
      : { [MetaSymbol]: void }
  >,
) => BindingT;
