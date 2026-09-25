export type UniqueKeyProbSegment = "__gts_unique_prob_seg__";

export type UnionToIntersection<U> = (
  U extends any ? (k: U) => void : never
) extends (k: infer I) => void
  ? I
  : never;

export type WithMeta<Def, Meta> = { "~meta": Meta } & Omit<Def, "~meta">;

// Keep lookups non-distributive, matching the generated concrete-type checks.
export type Member<
  Def,
  AttrName extends PropertyKey,
  AttrProp extends PropertyKey,
  F,
> = [Def] extends [Record<AttrName, Record<AttrProp, infer V>>] ? V : F;

export type RequiredAttrs<Def extends {}> = {
  [AttrName in keyof Def]: Def[AttrName] extends { required(this: Def): true }
    ? AttrName
    : never;
}[keyof Def];

export type RequiredMessage<
  ExpectedAttributes extends PropertyKey,
  ProvidedAttributes,
> = {
  [K in ExpectedAttributes]: K extends ProvidedAttributes
    ? never
    : `'${K & (string | number)}' is a required attribute but not provided`;
}[ExpectedAttributes];

/** Used by generated virtual TypeScript to report missing required attributes. */
export function checkRequired<ErrorMsg, Constraint>(
  value: [ErrorMsg] extends [Constraint] ? string : ErrorMsg,
): void {}

export type MergeMeta<Def, AttrName extends PropertyKey> = Member<
  Def,
  AttrName,
  "mergeMeta",
  <const T>(x: T, y: unknown) => T
>;
