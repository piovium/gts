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

export class ViewModel<ModelT, BlockDef extends AttributeBlockDefinition>
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

function defineViewModel<
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
  as?(innerMeta?: any): any;
}

interface AttributePositionalReturnBase {
  rewriteMeta?: any;
  namedDefinition: AttributeBlockDefinition;
}

const MetaSymbol: unique symbol = Symbol("Meta");
type MetaSymbol = typeof MetaSymbol;

export const ActionSymbol: unique symbol = Symbol("Action");
export type ActionSymbol = typeof ActionSymbol;

namespace AttributeReturn {
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

type AttributeAction<Model, T extends AttributeDefinition, BindingT> = (
  model: Model,
  positional: Parameters<T>,
  named: View<
    ReturnType<T>["namedDefinition"] extends AttributeBlockDefinition
      ? ReturnType<T>["namedDefinition"]
      : { [MetaSymbol]: void }
  >,
) => BindingT;

// Example usage:

class CharacterBuilder {
  addSkill(skill: CharacterSkillBuilder) {}
}

type CharacterHandle<VarNames extends string> = number & { readonly _character: unique symbol, readonly varNames: VarNames };

type BuilderMeta = {
  vars: string;
};

import AR = AttributeReturn;

const CharacterVM = defineViewModel(
  CharacterBuilder,
  (helper) => ({
    name: helper.attribute<{
      (name: string): AR.Done;
    }>((model, [name]) => {}),
    id: helper.attribute<{
      (id: number): AttributePositionalReturnBase;
      as<TMeta extends BuilderMeta>(this: AR.This<TMeta>): CharacterHandle<TMeta["vars"]>;
    }>((model, [id]) => {
      // model.setId(id);
      return id as CharacterHandle<any>;
    }),

    variable: helper.attribute<{
      <TMeta extends BuilderMeta, const TVarName extends string>(
        this: AR.This<TMeta>,
        variable: TVarName,
        initialValue: number,
      ): AR.WithRewriteMeta<
        typeof VariableVM,
        {
          vars: TMeta["vars"] | TVarName;
        }
      >;
    }>(() => {}),

    skill: helper.attribute<{
      <TMeta extends BuilderMeta>(this: AR.This<TMeta>): AR.With<
        typeof CharacterSkillVM,
        TMeta
      >;
    }>((model, _, named) => {
      const skill = CharacterSkillVM.parse(named);
      model.addSkill(skill);
    }),
  }),
  <{ vars: never }>{},
);

class CharacterSkillBuilder {}

interface SkillContext<TMeta extends BuilderMeta> {
  getVariable<TVarName extends TMeta["vars"]>(name: TVarName): number;
}

type SkillAction<TMeta extends BuilderMeta> = (
  ctx: SkillContext<TMeta>,
) => void;

const CharacterSkillVM = defineViewModel(
  CharacterSkillBuilder,
  (helper) => ({
    cost: helper.attribute<{
      (element: string, amount: number): AttributePositionalReturnBase;
    }>((model, [element, amount]) => {}),
    [ActionSymbol]: helper.attribute<{
      <TMeta extends BuilderMeta>(
        this: AR.This<TMeta>,
        action: SkillAction<TMeta>,
      ): AR.Done;
    }>((model, [action]) => {}),
  }),
  <{ vars: never }>{},
);

class VariableBuilder {}

const VariableVM = defineViewModel(VariableBuilder, (helper) => ({}));

// Testing TS virtual scode

// prettier-ignore
function test() {
  const Abc: Binding1 = (void 0)!;

  type VMDef = (typeof CharacterVM)[NamedDefinition];

  type Meta0 = VMDef[MetaSymbol];

  let obj0!: { [MetaSymbol]: Meta0 } & Omit<VMDef, MetaSymbol>;

  let return0 = obj0.id(123);
  type Return0 = typeof return0;
  type Meta1 = Return0 extends { rewriteMeta: infer NewMeta extends {} } ? NewMeta : Meta0;
  let obj1!: { [MetaSymbol]: Meta1 } & Omit<VMDef, MetaSymbol>;
  type AsType1 = typeof obj0.id extends { as: infer As } ? As : unknown;
  let inferBindingObj1 = { [MetaSymbol]: obj1[MetaSymbol], as: void 0 as any as AsType1 };
  let binding1 = inferBindingObj1.as();
  type Binding1 = typeof binding1;

  let return1 = obj1.variable("health", 10);
  type Return1 = typeof return1;
  type Meta2 = Return1["rewriteMeta"] extends undefined ? Meta1 : Return1["rewriteMeta"];
  let obj2!: { [MetaSymbol]: Meta2 } & Omit<VMDef, MetaSymbol>;
  let inferBindingObj2 = "as" in obj1.variable ? { ...obj2, as: obj1.variable.as }: obj2;

  let return2 = obj2.variable("stamina", 5);
  type Return2 = typeof return2;
  type Meta3 = Return2["rewriteMeta"] extends undefined ? Meta2 : Return2["rewriteMeta"];
  let obj3!: { [MetaSymbol]: Meta3 } & Omit<VMDef, MetaSymbol>;

  let return3 = obj3.skill();
  type Return3 = typeof return3;

  /****/type VMDef3 = Return3 extends { namedDefinition: infer Def } ? Def : {};
  /****/type Meta3_1 = VMDef3[MetaSymbol];
  /****/let obj3_1!: { [MetaSymbol]: Meta3_1 } & Omit<VMDef3, MetaSymbol>;
  /****/let return3_1 = obj3_1.cost("mana", 20);
  /****/type Return3_1 = typeof return3_1;

  /****/type Meta3_2 = Return3_1 extends { rewriteMeta: infer NewMeta extends {} } ? NewMeta : Meta3_1;
  /****/let obj3_2!: { [MetaSymbol]: Meta3_2 } & Omit<VMDef3, MetaSymbol>;
  /****/let return3_2 = obj3_2[ActionSymbol]((arg) => {
  /****/  let v0 = arg.getVariable("health");
  /****/});
  /****/type Return3_2 = typeof return3_2;

}
