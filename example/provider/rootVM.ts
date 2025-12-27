import {
  ActionSymbol,
  defineViewModel,
  type AttributeReturn as AR,
} from "~runtime";

class CharacterBuilder {
  addSkill(skill: CharacterSkillBuilder) {}
}

type CharacterHandle<VarNames extends string> = number & {
  readonly _character: unique symbol;
  readonly varNames: VarNames;
};

type BuilderMeta = {
  vars: string;
};

type Tag = "hydro" | "catalyst" | "mondstadt" | "liyue" | "pole" | "pyro";

type CharacterSkillHandle = number & {
  readonly _characterSkill: unique symbol;
}

const CharacterVM = defineViewModel(
  CharacterBuilder,
  (helper) => ({
    id: helper.attribute<{
      (id: number): AR.Done;
      required(): true;
      as<TMeta extends BuilderMeta>(
        this: AR.This<TMeta>
      ): CharacterHandle<TMeta["vars"]>;
    }>((model, [id]) => {
      // model.setId(id);
      return id as CharacterHandle<any>;
    }),
    since: helper.attribute<{
      (sinceVersion: "v3.3.0" | "v3.4.0"): AR.Done;
    }>((model, [sinceVersion]) => {}),

    tags: helper.attribute<{
      (...tags: Tag[]): AR.Done;
    }>(() => {}),

    health: helper.attribute<{
      (value: number): AR.Done;
    }>(() => {}),

    energy: helper.attribute<{
      (value: number): AR.Done;
    }>(() => {}),

    skills: helper.attribute<{
      (...skillHandles: CharacterSkillHandle[]): AR.Done;
    }>(() => {}),

    variable: helper.attribute<{
      <TMeta extends BuilderMeta, const TVarName extends string>(
        this: AR.This<TMeta>,
        variable: TVarName,
        initialValue: number
      ): AR.WithRewriteMeta<
        typeof VariableVM,
        {
          vars: TMeta["vars"] | TVarName;
        }
      >;
      required<TMeta extends BuilderMeta>(
        this: AR.This<TMeta>
      ): TMeta["vars"] extends never ? true : false;
    }>(() => {}),

    // skill: helper.attribute<{
    //   <TMeta extends BuilderMeta>(this: AR.This<TMeta>): AR.With<
    //     typeof CharacterSkillVM,
    //     TMeta
    //   >;
    // }>((model, _, named) => {
    //   const skill = CharacterSkillVM.parse(named);
    //   model.addSkill(skill);
    // }),
  }),
  {} as { vars: never }
);

class CharacterSkillBuilder {}

interface SkillContext<TMeta extends BuilderMeta> {
  getVariable<TVarName extends TMeta["vars"]>(name: TVarName): number;
}

type SkillAction<TMeta extends BuilderMeta> = (
  ctx: SkillContext<TMeta>
) => void;

const CharacterSkillVM = defineViewModel(
  CharacterSkillBuilder,
  (helper) => ({
    id: helper.attribute<{
      (id: number): AR.Done;
      required(): true;
      as<TMeta extends BuilderMeta>(
        this: AR.This<TMeta>
      ): CharacterSkillHandle;
    }>((model, [id]) => {
      // model.setId(id);
      return id as CharacterSkillHandle;
    }),
    cost: helper.attribute<{
      (element: string, amount: number): AR.Done;
    }>((model, [element, amount]) => {}),
    [ActionSymbol]: helper.attribute<{
      <TMeta extends BuilderMeta>(
        this: AR.This<TMeta>,
        action: SkillAction<TMeta>
      ): AR.Done;
    }>((model, [action]) => {}),
  }),
  {} as { vars: never }
);

class VariableBuilder {}

const VariableVM = defineViewModel(VariableBuilder, (helper) => ({}));

class RootBuilder {}

export default defineViewModel(RootBuilder, (helper) => ({
  character: helper.attribute<{
    (): AR.With<typeof CharacterVM, { vars: never }>;
  }>((model, _, named) => {
    const character = CharacterVM.parse(named);
    // model.addCharacter(character);
    return character;
  }),
  skill: helper.attribute<{
    (): AR.With<typeof CharacterSkillVM>;
  }>(() => {}),
}));

// Binding region


const Abc: Binding1 = (void 0)!;

// Preface region

type MetaSymbol = typeof CharacterVM._symbols.MetaSymbol;
let MetaSymbol!: MetaSymbol;
type NamedDefinition = typeof CharacterVM._symbols.NamedDefinition;

// Block Start

type VMDef = (typeof CharacterVM)[NamedDefinition];
type Meta0 = VMDef[MetaSymbol];

// Attribute

let obj0!: { [MetaSymbol]: Meta0 } & Omit<VMDef, MetaSymbol>;
let return0 = obj0.id(123);
type Return0 = typeof return0;
type Meta1 = Return0 extends { rewriteMeta: infer NewMeta extends {} }
  ? NewMeta
  : Meta0;

let obj1!: { [MetaSymbol]: Meta1 } & Omit<VMDef, MetaSymbol>;
type AsType1 = FinalObj["id"] extends { as: infer As } ? As : unknown;
let inferBindingObj1 = { [MetaSymbol]: obj1[MetaSymbol], as: null! as AsType1 };
let binding1 = inferBindingObj1.as();
type Binding1 = typeof binding1;

let return1 = obj1.variable("health", 10);
type Return1 = typeof return1;
type Meta2 = Return1["rewriteMeta"] extends undefined
  ? Meta1
  : Return1["rewriteMeta"];
let obj2!: { [MetaSymbol]: Meta2 } & Omit<VMDef, MetaSymbol>;
type AsType2 = FinalObj["variable"] extends { as: infer As } ? As : unknown;
let inferBindingObj2 = { [MetaSymbol]: obj2[MetaSymbol], as: null! as AsType2 };

let return2 = obj2.variable("stamina", 5);
type Return2 = typeof return2;
type Meta3 = Return2["rewriteMeta"] extends undefined
  ? Meta2
  : Return2["rewriteMeta"];
let obj3!: { [MetaSymbol]: Meta3 } & Omit<VMDef, MetaSymbol>;

let return3 = obj3.skill();
type Return3 = typeof return3;

// Block2 start

/****/ type VMDef3 = Return3 extends { namedDefinition: infer Def } ? Def : {};
/****/ type Meta3_1 = VMDef3[MetaSymbol];
/****/ let obj3_1!: { [MetaSymbol]: Meta3_1 } & Omit<VMDef3, MetaSymbol>;
/****/ let return3_1 = obj3_1.cost("mana", 20);
/****/ type Return3_1 = typeof return3_1;

/****/ type Meta3_2 = Return3_1 extends {
  rewriteMeta: infer NewMeta extends {};
}
  ? NewMeta
  : Meta3_1;
/****/ let obj3_2!: { [MetaSymbol]: Meta3_2 } & Omit<VMDef3, MetaSymbol>;
/****/ let return3_2 = obj3_2[ActionSymbol]((arg) => {
  /****/ let v0 = arg.getVariable("health");
  /****/
});
/****/ type Return3_2 = typeof return3_2;

type Obj3 = typeof obj0;

// Block end
let finalObj = obj3;
type FinalObj = typeof finalObj;
type RequiredProperties = {
  [K in keyof FinalObj]: FinalObj[K] extends { required(this: FinalObj): true }
    ? K
    : never;
}[keyof VMDef];

declare namespace __A {
  type CollectedPropertyOfCharacterVM = {
    id: 0;
  };
  type RequiredPropertyOfCharacterVM = {
    [K in RequiredProperties]: 0;
  };
}
const check = ((_: __A.RequiredPropertyOfCharacterVM) => 0)(
  {} as __A.CollectedPropertyOfCharacterVM
);
