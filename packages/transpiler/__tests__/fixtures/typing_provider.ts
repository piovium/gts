type This<M> = { "~meta": M };
type Done = { namedDefinition: { "~meta": void } };
type With<D> = { namedDefinition: D };
type Rewrite<M> = Done & { rewriteMeta: M };
type Meta = { names: string; mode: boolean };
interface Context<M extends Meta> {
  get(name: M["names"]): number;
}
interface Definition {
  "~meta": { names: never; mode: false };
  id: {
    (value: number): Done;
    required(): true;
    uniqueKey(): "id";
    as<M extends Meta>(this: This<M>): M;
  };
  plainId: { (id: number): Done; as(): number };
  fromId<const Id extends number>(
    id: Id,
  ): Rewrite<{ names: never; mode: false; id: Id }>;
  variable: {
    <M extends Meta, const N extends string>(
      this: This<M>,
      name: N,
    ): Rewrite<{ names: M["names"] | N; mode: M["mode"] }>;
  };
  since: { (version: number): Done; uniqueKey(): "version" };
  until: { (version: number): Done; uniqueKey(): "version" };
  enable: { (): Rewrite<{ names: never; mode: true }> };
  conditional: { (): Done; required<M extends Meta>(this: This<M>): M["mode"] };
  child: {
    (): With<Definition>;
    mergeMeta<M extends Meta, N extends Meta>(
      meta: M,
      child: N,
    ): { names: M["names"] | N["names"]; mode: M["mode"] };
  };
  when<M extends Meta>(this: This<M>, fn: (ctx: Context<M>) => boolean): Done;
  overloaded: {
    (value: number): Rewrite<{ names: "number"; mode: false }>;
    (value: string): Rewrite<{ names: "string"; mode: false }>;
  };
  "~action"<M extends Meta>(
    this: This<M>,
    action: (ctx: Context<M>) => void,
  ): Done;
}
declare const root: {
  "~namedDefinition": {
    "~meta": unknown;
    item(): With<Definition>;
    scoped(): With<{
      "~meta": { first: "a"; second: "b" };
      first: {
        (): Done;
        uniqueKey<M extends { first: string }>(this: This<M>): M["first"];
      };
      second: {
        (): Done;
        uniqueKey<M extends { second: string }>(this: This<M>): M["second"];
      };
    }>;
    union():
      | With<{ "~meta": { kind: "a" }; value(value: number): Done }>
      | With<{ "~meta": { kind: "b" }; value(value: number): Done }>;
    anything(): any;
    hintProbe(): With<{
      "~meta": void;
      "~attrNameHint": { (): Done; uniqueKey(): "shared" };
      first: { (): Done; uniqueKey(): "shared" };
    }>;
  };
};
export default root;
export declare function createBinding(): void;
export declare function createDefine(): void;
