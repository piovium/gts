import {
  defineSimpleViewModel,
  defineViewModel,
  type AR,
} from "@gi-tcg/gts-runtime";
import { type } from "arktype";

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
      uniqueKey(): "id";
      as<TMeta extends BuilderMeta>(
        this: AR.This<TMeta>,
      ): CharacterHandle<TMeta["varNames"]>;
    }>(
      (model, pos) => {
        // model.setId(id);
      },
      (_, [id]) => {
        return id as CharacterHandle<any>;
      },
    ),
    since: helper.attribute<{
      (sinceVersion: "v3.3.0" | "v3.4.0"): AR.Done;
      uniqueKey: () => "version";
    }>((model, [sinceVersion]) => {
      model.setVersion(sinceVersion);
    }),
    until: helper.attribute<{
      (untilVersion: "v3.3.0" | "v3.4.0"): AR.Done;
      uniqueKey: () => "version";
    }>((model, [untilVersion]) => {
      // model.setUntilVersion(untilVersion);
    }),

    tags: helper.simpleAttribute()(function (...tags: Tag[]) {}),

    health: helper.simpleAttribute({
      uniqueKey: "health",
    })(function (value: number) {}),

    energy: helper.simpleAttribute({
      required: true,
      uniqueKey: "energy",
    })(function (value: number) {}),

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

class SkillBuilder {
  constructor(characterId?: number) {}
}

export interface QueryBuilder {
  my: QueryBuilder;
  opp: QueryBuilder;
  character: QueryBuilder;
  active: QueryBuilder;
}

export interface Query {
  readonly _query: unique symbol;
  readonly variables: Record<string, number>;
}

interface SkillContext<TMeta extends BuilderMeta> {
  $: QueryBuilder;
  getVariable<TVarName extends TMeta["varNames"]>(name: TVarName): number;
  damage(type: number, count: number): void;
  summon(type: SummonHandle<any>): void;
  heal(count: number, query: null | Query | Query[]): void;
  apply(type: number, query: null | Query | Query[]): void;
  query(query: QueryBuilder): Query | null;
  queryAll(query: QueryBuilder): Query[];
  // test: { foo: number} | null;
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
      (_, [id]) => {
        return id as CharacterSkillHandle;
      },
    ),
    cost: helper.simpleAttribute()(function (
      element: number,
      amount: number,
    ) {}),

    when: helper.simpleAttribute()(function (
      condition: (ctx: SkillContext<any>) => boolean,
    ) {}),

    hint: helper.simpleAttribute()(function (
      icon: number,
      text: string | number,
    ) {}),

    variable: helper.attribute<{
      <TMeta extends BuilderMeta, const TVarName extends string>(
        this: AR.This<TMeta>,
        variable: TVarName,
        initialValue: number,
      ): AR.WithRewriteMeta<
        {
          varNames: TMeta["varNames"] | TVarName;
        },
        typeof VariableVM
      >;
    }>(() => {}),

    "~action": helper.attribute<{
      <TMeta extends BuilderMeta>(
        this: AR.This<TMeta>,
        action: SkillAction<TMeta>,
      ): AR.Done;
    }>((model, pos) => {}),
  }),
  {} as { varNames: never } satisfies BuilderMeta,
);

const VariableVM = defineSimpleViewModel(
  type({
    "append?": [
      {
        "limit?": "number",
        "value?": "number",
      },
      "|",
      "boolean",
    ],
    "visible?": "boolean",
  }),
  {
    booleanSwitch: true,
    recursive: true,
  },
);

class EntityBuilder {
  constructor(type: "summon" | "status") {}
}

type SummonHandle<VarNames extends string> = number & {
  readonly _summon: unique symbol;
  readonly varNames: VarNames;
};

const EntityVM = defineViewModel(
  EntityBuilder,
  (helper) => ({
    id: helper.attribute<{
      (id: number): AR.Done;
      as<TMeta extends BuilderMeta>(
        this: AR.This<TMeta>,
      ): SummonHandle<TMeta["varNames"]>;
    }>(
      (model, [id]) => {
        // this.id = id;
      },
      (model, [id]) => id as SummonHandle<any>,
    ),

    oops: undefined,

    usage: helper.attribute<{
      <TMeta extends BuilderMeta>(
        this: AR.This<TMeta>,
        count: number,
      ): AR.WithRewriteMeta<
        {
          varNames: TMeta["varNames"] | "usage";
        },
        typeof VariableVM
      >;
    }>(() => {}),

    on: helper.attribute<{
      /** Add a triggered skill. */
      <Meta extends BuilderMeta>(
        this: AR.This<Meta>,
        eventName: "endPhase" | "actionPhase",
      ): AR.With<typeof SkillVM, { varNames: Meta["varNames"] }>;
      mergeMeta: <
        const TMeta extends BuilderMeta,
        const TSubMeta extends BuilderMeta,
      >(
        meta: TMeta,
        subMeta: TSubMeta,
      ) => {
        varNames: TMeta["varNames"] | TSubMeta["varNames"];
      };
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
    const skill = SkillVM.parse(named, 0);
    registered.push(skill);
  }, SkillVM),
  summon: helper.attribute<{
    (): AR.With<typeof EntityVM, { varNames: never }>;
  }>((model, _, named) => {
    const summon = EntityVM.parse(named, "summon");
    registered.push(summon);
  }, EntityVM.bind("summon")),
}));
