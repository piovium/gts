import type {
  AttributeBlockDefinition,
  BlockDefinitionRewriteMeta,
  IViewModelInstance,
} from "./view_model.ts";

export type Computed<T, Constraint = any> = T extends Constraint
  ? { [K in keyof T]: T[K] }
  : never;

export interface AttributePositionalReturnBase {
  key?: string;
  rewriteMeta?: any;
  namedDefinition: AttributeBlockDefinition;
}

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
    VMI extends IViewModelInstance,
    TMeta = VMI["~viewModel"]["~namedDefinition"]["~meta"],
  > = {
    namedDefinition: BlockDefinitionRewriteMeta<
      VMI["~viewModel"]["~namedDefinition"],
      TMeta
    >;
  };

  export type DoneRewriteMeta<NewMeta> = {
    namedDefinition: { "~meta": void };
    rewriteMeta: NewMeta;
  };

  export type WithRewriteMeta<
    NewMeta,
    VMI extends IViewModelInstance,
    TMeta = VMI["~viewModel"]["~namedDefinition"]["~meta"],
  > = {
    namedDefinition: BlockDefinitionRewriteMeta<
      VMI["~viewModel"]["~namedDefinition"],
      TMeta
    >;
    rewriteMeta: NewMeta;
  };
}

export type { AttributeReturn as AR };
