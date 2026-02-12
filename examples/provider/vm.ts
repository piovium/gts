import type { Query } from "./query";
import {
  Action,
  Prelude,
  defineViewModel,
  type AttributeReturn as AR,
} from "./runtime";

class CharacterBuilder {
  setVersion(version: "v3.3.0" | "v3.4.0") {}
  addSkill(skill: SkillBuilder) {}
}

type CharacterHandle<VarNames extends string> = number & {
  readonly _character: unique symbol;
  readonly varNames: VarNames;
};

type BuilderMeta = {
  varNames: string;
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
      ): CharacterHandle<TMeta["varNames"]>;
    }>(
      (model, pos) => {
        // model.setId(id);
      },
      (_, pos) => {
        const [id] = pos();
        return id as CharacterHandle<any>;
      },
    ),
    since: helper.simpleAttribute(function (sinceVersion: "v3.3.0" | "v3.4.0") {
      this.setVersion(sinceVersion);
    }),

    tags: helper.simpleAttribute(function (...tags: Tag[]) {}),

    health: helper.simpleAttribute(function (value: number) {}),

    energy: helper.simpleAttribute(function (value: number) {}),

    skills: helper.attribute<{
      (...skillHandles: CharacterSkillHandle[]): AR.Done;
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
  {} as { varNames: never } satisfies BuilderMeta,
);

class SkillBuilder {}

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
  getVariable<TVarName extends TMeta["varNames"]>(name: TVarName): number;
  damage(type: number, count: number): void;
  summon(type: SummonHandle<any>): void;
  heal(count: number, query: Query): void;
  apply(type: number, query: Query): void;
}

type SkillAction<TMeta extends BuilderMeta> = (
  ctx: SkillContext<TMeta>,
) => void;

const SkillVM = defineViewModel(
  SkillBuilder,
  (helper) => ({
    id: helper.attribute<{
      (id: number): AR.Done;
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
    cost: helper.simpleAttribute(function (element: string, amount: number) {}),

    when: helper.simpleAttribute(function (condition: (ctx: SkillContext<any>) => boolean) {}),

    hint: helper.simpleAttribute(function (icon: "heal", text: string | number) {}),

    variable: helper.attribute<{
      <TMeta extends BuilderMeta, const TVarName extends string>(
        this: AR.This<TMeta>,
        variable: TVarName,
        initialValue: number,
      ): AR.WithRewriteMeta<
        typeof VariableVM,
        {
          varNames: TMeta["varNames"] | TVarName;
        }
      >;
    }>(() => {}),

    [Action]: helper.attribute<{
      <TMeta extends BuilderMeta>(
        this: AR.This<TMeta>,
        action: SkillAction<TMeta>,
      ): AR.Done;
    }>((model, pos) => {}),
  }),
  {} as { varNames: never } satisfies BuilderMeta,
);

class VariableBuilder {}

const VariableVM = defineViewModel(VariableBuilder, (helper) => ({}));

class SummonBuilder {}

type SummonHandle<VarNames extends string> = number & {
  readonly _summon: unique symbol;
  readonly varNames: VarNames;
};

const SummonVM = defineViewModel(
  SummonBuilder,
  (helper) => ({
    id: helper.attribute<{
      (id: number): AR.Done;
      required(): true;
      as<TMeta extends BuilderMeta>(
        this: AR.This<TMeta>,
      ): SummonHandle<TMeta["varNames"]>;
    }>(
      (model, pos) => {
        // model.setId(id);
      },
      (_, pos) => {
        const [id] = pos();
        return id as SummonHandle<any>;
      },
    ),

    usage: helper.attribute<{
      <TMeta extends BuilderMeta>(
        this: AR.This<TMeta>,
        count: number,
      ): AR.WithRewriteMeta<
        typeof VariableVM,
        {
          varNames: TMeta["varNames"] | "usage";
        }
      >;
    }>(() => {}),

    on: helper.attribute<{
      <Meta extends BuilderMeta>(
        this: AR.This<Meta>,
        eventName: "endPhase" | "actionPhase",
      ): AR.With<typeof SkillVM, { varNames: Meta["varNames"] }>;
    }>((model, pos) => {}),
  }),
  {} as { varNames: never } satisfies BuilderMeta,
);

class RootBuilder {}

export const registered: any[] = [];

export default defineViewModel(RootBuilder, (helper) => ({
  character: helper.attribute<{
    (): AR.With<typeof CharacterVM, { varNames: never }>;
  }>((model, _, named) => {
    const character = CharacterVM.parse(named);
    registered.push(character);
  }, CharacterVM),
  skill: helper.attribute<{
    (): AR.With<typeof SkillVM, { varNames: never }>;
  }>((model, _, named) => {
    const skill = SkillVM.parse(named);
    registered.push(skill);
  }, SkillVM),
  summon: helper.attribute<{
    (): AR.With<typeof SummonVM, { varNames: never }>;
  }>((model, _, named) => {
    const summon = SummonVM.parse(named);
    registered.push(summon);
  }, SummonVM),
}));
