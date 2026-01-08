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
  NewMeta
> = Computed<
  Omit<BlockDef, Meta> & { [Meta]: NewMeta }
> extends infer R extends AttributeBlockDefinition
  ? R
  : never;

export interface IViewModel<ModelT, BlockDef extends AttributeBlockDefinition> {
  parse(view: View<BlockDefinitionRewriteMeta<BlockDef, unknown>>): ModelT;
}

export class ViewModel<ModelT, BlockDef extends AttributeBlockDefinition>
  implements IViewModel<ModelT, BlockDef>
{
  /**
   * Helper for fetching symbol types
   * @internal
   */
  declare _symbols: AllSymbols;

  declare [NamedDefinition]: BlockDef;
  #registeredActions: Map<PropertyKey, AttributeAction<ModelT, any>> = new Map();

  constructor(private Ctor: new () => ModelT) {}

  _setAction(name: PropertyKey, action: AttributeAction<ModelT, any>) {
    this.#registeredActions.set(name, action);
  }

  parse(view: View<BlockDefinitionRewriteMeta<BlockDef, unknown>>): ModelT {
    const model = new this.Ctor();
    for (const attrNode of view._node.attributes) {
      let { name, positionals, named, binding } = attrNode;
      const action = this.#registeredActions.get(name);
      if (!action) {
        throw new Error(`No action registered for attribute: ${String(name)}`);
      }
      named ??= { attributes: [] };
      const positionalValues = positionals();
      const value = action(model, positionalValues, new View(named));
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

  _assignActions(defResult: Record<string, unknown>) {
    for (const [name, returnValue] of Object.entries(defResult)) {
      const desc = Object.getOwnPropertyDescriptor(
        returnValue,
        AttributeDefHelper.#actionSlot
      );
      if (desc) {
        this.#viewModel._setAction(name, desc.value);
      }
    }
  }

  attribute<T extends AttributeDefinition>(
    action: AttributeAction<ModelT, T>
  ): T {
    const returnValue = {} as T;
    Object.defineProperty(returnValue, AttributeDefHelper.#actionSlot, {
      value: action,
      enumerable: true
    });
    return returnValue as T;
  }
}

export function defineViewModel<
  T,
  const BlockDef extends Record<string, AttributeDefinition>,
  InitMeta = void
>(
  Ctor: new () => T,
  modelDefFn: (helper: AttributeDefHelper<T>) => BlockDef,
  initMeta?: InitMeta
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
  required?(): boolean;
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
    TMeta = VM[NamedDefinition][Meta]
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
  positional: Parameters<T>,
  named: View<
    ReturnType<T>["namedDefinition"] extends AttributeBlockDefinition
      ? ReturnType<T>["namedDefinition"]
      : { [Meta]: void }
  >
) => void;
