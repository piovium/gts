/**
 * VM builder types for GamingTS
 * This is a bundled declaration file with all types inlined
 */

/** Re-exported Query types */
export interface QueryBuilder {
  my: QueryBuilder;
  opp: QueryBuilder;
  character: QueryBuilder;
  active: QueryBuilder;
}

export type Query = {
  readonly _query: unique symbol;
};

/** Re-exported runtime types */
declare const Action: unique symbol;
declare const Prelude: unique symbol;

declare namespace AttributeReturn {
  export type Done = { readonly _done: unique symbol };
  export type This<TMeta> = { readonly _meta: TMeta };
  export type With<TVM, TMeta = never> = {
    readonly _with: unique symbol;
    readonly vm: TVM;
    readonly meta: TMeta;
  };
  export type WithRewriteMeta<TVM, TMeta> = {
    readonly _withRewrite: unique symbol;
    readonly vm: TVM;
    readonly meta: TMeta;
  };
}

interface IViewModel<TModel, TMeta> {
  readonly model: new () => TModel;
  readonly meta: TMeta;
  parse(attributes: any): TModel;
}

declare function defineViewModel<TModel, TMeta, TAttrs>(
  modelClass: new () => TModel,
  defineAttributes: (helper: any) => TAttrs,
  metaDefaults?: TMeta
): IViewModel<TModel, TMeta> & TAttrs;

declare function defineSimpleViewModel<TSchema>(schema: TSchema): IViewModel<any, any>;

/** VM-specific types */
declare class CharacterBuilder {
  setVersion(version: "v3.3.0" | "v3.4.0"): void;
  addSkill(skill: any): void;
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

declare class SkillBuilder {}

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

type SkillAction<TMeta extends BuilderMeta> = (ctx: SkillContext<TMeta>) => void;

declare class SummonBuilder {}

type SummonHandle<VarNames extends string> = number & {
  readonly _summon: unique symbol;
  readonly varNames: VarNames;
};

declare class RootBuilder {}

/** Exported members from vm.ts */
export declare const registered: any[];

declare const _default: IViewModel<RootBuilder, any> & {
  character: any;
  skill: any;
  summon: any;
};

export default _default;
