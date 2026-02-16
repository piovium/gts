/**
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
