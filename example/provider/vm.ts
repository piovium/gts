import {
  Action,
  Prelude,
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
};

const CharacterVM = defineViewModel(
  CharacterBuilder,
  (helper) => ({
    id: helper.attribute<{
      (id: number): AR.Done;
      required(): true;
      as<TMeta extends BuilderMeta>(
        this: AR.This<TMeta>,
      ): CharacterHandle<TMeta["vars"]>;
    }>(
      (model, pos) => {
        // model.setId(id);
      },
      (_, pos) => {
        const [id] = pos();
        return id as CharacterHandle<any>;
      },
    ),
    since: helper.attribute<{
      (sinceVersion: "v3.3.0" | "v3.4.0"): AR.Done;
    }>((model, pos) => {}),

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
        initialValue: number,
      ): AR.WithRewriteMeta<
        typeof VariableVM,
        {
          vars: TMeta["vars"] | TVarName;
        }
      >;
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
  {} as { vars: never },
);

class CharacterSkillBuilder {}

interface SkillContext<TMeta extends BuilderMeta> {
  [Prelude]: {
    cryo: number;
    hydro: number;
    pyro: number;
    electro: number;
    anemo: number;
    geo: number;
    dendro: number;
    omni: number;
  };
  getVariable<TVarName extends TMeta["vars"]>(name: TVarName): number;
}

type SkillAction<TMeta extends BuilderMeta> = (
  ctx: SkillContext<TMeta>,
) => void;

const CharacterSkillVM = defineViewModel(
  CharacterSkillBuilder,
  (helper) => ({
    id: helper.attribute<{
      (id: number): AR.Done;
      required(): true;
      as<TMeta extends BuilderMeta>(this: AR.This<TMeta>): CharacterSkillHandle;
    }>(
      (model, pos) => {
        // model.setId(id);
      },
      (_, pos) => {
        const [id] = pos();
        return id as CharacterSkillHandle;
      },
    ),
    cost: helper.attribute<{
      (element: string, amount: number): AR.Done;
    }>((model, pos) => {}),
    [Action]: helper.attribute<{
      <TMeta extends BuilderMeta>(
        this: AR.This<TMeta>,
        action: SkillAction<TMeta>,
      ): AR.Done;
    }>((model, pos) => {}),
  }),
  {} as { vars: never },
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
  }, CharacterVM),
  skill: helper.attribute<{
    (): AR.With<typeof CharacterSkillVM>;
  }>(() => {}, CharacterSkillVM),
}));
