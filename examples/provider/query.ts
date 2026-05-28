export interface QueryBuilder {
  my: QueryBuilder;
  opp: QueryBuilder;
  character: QueryBuilder;
  active: QueryBuilder;
}

export type Query = { readonly _query: unique symbol };

export default function query(
  queryFn: (querier: QueryBuilder) => unknown,
  option: { star: boolean, context: any },
): Query {
  return {} as Query;
}
