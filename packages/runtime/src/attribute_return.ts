import type { BlockDefinitionRewriteMeta, IViewModel } from "./view_model.ts";

export namespace AttributeReturn {
  export type This<TMeta> = {
    "~meta": TMeta;
  };

  export type EnableIf<Condition, T = void> = Condition extends true
    ? T
    : never;

  export type Done = {
    namedDefinition: { "~meta": void };
  };

  export type With<
    VM extends IViewModel<any, any, any>,
    TMeta = VM["~namedDefinition"]["~meta"],
  > = {
    namedDefinition: BlockDefinitionRewriteMeta<VM["~namedDefinition"], TMeta>;
  };

  export type DoneRewriteMeta<NewMeta> = {
    namedDefinition: { "~meta": void };
    rewriteMeta: NewMeta;
  };

  export type WithRewriteMeta<VM extends IViewModel<any, any, any>, NewMeta> = {
    namedDefinition: VM["~namedDefinition"];
    rewriteMeta: NewMeta;
  };
}

export type { AttributeReturn as AR };
