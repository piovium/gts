// we just write this time by time.
// we know this is not a good way to write typescript, but thats the only way to achieve our goal

type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (
  k: infer I,
) => void
  ? I
  : never;

type LastOf<T> =
  UnionToIntersection<T extends any ? () => T : never> extends () => infer R
    ? R
    : never;

type Push<T extends any[], V> = [...T, V];
export type TuplifyUnion<
  T,
  L = LastOf<T>,
  N = [T] extends [never] ? true : false,
> = true extends N ? [] : Push<TuplifyUnion<Exclude<T, L>>, L>;

export type IsSingleton<T, L = LastOf<T>> = [T] extends [never]
  ? false
  : [Exclude<T, L>] extends [never]
    ? true
    : false;
