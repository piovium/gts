export const Meta: unique symbol = Symbol("Meta");
export type Meta = typeof Meta;

export const Action: unique symbol = Symbol("Action");
export type Action = typeof Action;

export const NamedDefinition: unique symbol = Symbol("NamedDefinition");
export type NamedDefinition = typeof NamedDefinition;

export const Prelude: unique symbol = Symbol("Prelude");
export type Prelude = typeof Prelude;

export type AllSymbols = {
  Meta: Meta;
  Action: Action;
  NamedDefinition: NamedDefinition;
  Prelude: Prelude;
};
