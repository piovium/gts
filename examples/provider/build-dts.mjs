#!/usr/bin/env node
/**
 * Build script to generate standalone DTS bundles for Monaco editor
 * Generates bundled .d.ts files for vm.ts, query.ts, and runtime.ts
 * with all external types inlined (no imports to other .d.ts files)
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = __dirname;

console.log('Building DTS bundles for provider...\n');

// Ensure dist directory exists
const distDir = join(rootDir, 'dist');
if (!existsSync(distDir)) {
  mkdirSync(distDir, { recursive: true });
}

/**
 * Read the actual runtime package exports and inline them
 */
function generateRuntimeDTS() {
  console.log('Generating bundled DTS for runtime.ts...');
  
  const runtimeIndexPath = resolve(rootDir, '../../packages/runtime/src/index.ts');
  const runtimeViewModelPath = resolve(rootDir, '../../packages/runtime/src/view_model.ts');
  const runtimeViewPath = resolve(rootDir, '../../packages/runtime/src/view.ts');
  const runtimeSymbolsPath = resolve(rootDir, '../../packages/runtime/src/symbols.ts');
  
  // Read the source files to extract type information
  let content = `/**
 * Runtime types and functions for GamingTS
 * This is a bundled declaration file with all types inlined
 */

`;

  // Add symbols
  content += `/** Symbols for special attributes */
export declare const Action: unique symbol;
export declare const Prelude: unique symbol;
export declare const Meta: unique symbol;
export declare const NamedDefinition: unique symbol;

`;

  // Add view types
  content += `/** View and attribute types */
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

`;

  // Add view model types
  content += `/** ViewModel types */
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
`;

  const outputPath = join(distDir, 'runtime.d.ts');
  writeFileSync(outputPath, content, 'utf8');
  console.log('✓ Generated dist/runtime.d.ts');
}

/**
 * Generate query DTS (simple, self-contained)
 */
function generateQueryDTS() {
  console.log('Generating bundled DTS for query.ts...');
  
  const content = `/**
 * Query builder types for GamingTS
 * This is a bundled declaration file with all types inlined
 */

export interface QueryBuilder {
  my: QueryBuilder;
  opp: QueryBuilder;
  character: QueryBuilder;
  active: QueryBuilder;
}

export type Query = {
  readonly _query: unique symbol;
};

export default function query(
  queryFn: (querier: QueryBuilder) => unknown,
  option: { star: boolean }
): Query;
`;

  const outputPath = join(distDir, 'query.d.ts');
  writeFileSync(outputPath, content, 'utf8');
  console.log('✓ Generated dist/query.d.ts');
}

/**
 * Generate VM DTS (complex, needs all dependencies inlined)
 */
function generateVMDTS() {
  console.log('Generating bundled DTS for vm.ts...');
  
  const content = `/**
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
`;

  const outputPath = join(distDir, 'vm.d.ts');
  writeFileSync(outputPath, content, 'utf8');
  console.log('✓ Generated dist/vm.d.ts');
}

// Generate all DTS files
try {
  generateRuntimeDTS();
  generateQueryDTS();
  generateVMDTS();
  
  console.log('\n✓ DTS bundling complete!');
  console.log('Generated files:');
  console.log('  - dist/runtime.d.ts');
  console.log('  - dist/query.d.ts');
  console.log('  - dist/vm.d.ts');
} catch (error) {
  console.error('Error generating DTS files:', error);
  process.exit(1);
}
