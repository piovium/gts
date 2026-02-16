/**
 * Runtime types and functions for GamingTS
 * This is a bundled declaration file with all types inlined
 */

/** Symbols for special attributes */
export declare const Action: unique symbol;
export declare const Prelude: unique symbol;
export declare const Meta: unique symbol;
export declare const NamedDefinition: unique symbol;

/** View and attribute types */
export interface SingleAttributeNode {
  readonly type: 'single';
  readonly name: string;
  readonly args: readonly unknown[];
}

export interface NamedAttributesNode {
  readonly type: 'named';
  readonly attributes: ReadonlyMap<string, unknown>;
}

export type View<T = unknown> = {
  readonly _view: unique symbol;
  readonly data: T;
};

export declare function createBinding<T>(value: T): View<T>;
export declare function createDefine<T>(fn: () => T): View<T>;

/** ViewModel types */
export interface AttributeDefinition<T = any> {
  readonly name: string;
  readonly handler: (...args: any[]) => any;
}

export declare namespace AttributeReturn {
  export type Done = { readonly _done: unique symbol };
  export type This<TMeta> = { readonly _meta: TMeta };
  export type With<TVM extends IViewModel<any, any>, TMeta = never> = {
    readonly _with: unique symbol;
    readonly vm: TVM;
    readonly meta: TMeta;
  };
  export type WithRewriteMeta<TVM extends IViewModel<any, any>, TMeta> = {
    readonly _withRewrite: unique symbol;
    readonly vm: TVM;
    readonly meta: TMeta;
  };
}

export interface IViewModel<TModel, TMeta> {
  readonly model: new () => TModel;
  readonly meta: TMeta;
  parse(attributes: NamedAttributesNode): TModel;
}

export declare function defineViewModel<TModel, TMeta, TAttrs>(
  modelClass: new () => TModel,
  defineAttributes: (helper: any) => TAttrs,
  metaDefaults?: TMeta
): IViewModel<TModel, TMeta> & TAttrs;

export declare function defineSimpleViewModel<TSchema>(
  schema: TSchema
): IViewModel<any, any>;

export type { AttributeReturn };
