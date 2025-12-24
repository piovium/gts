export const MetaSymbol: unique symbol = Symbol("Meta");
export type MetaSymbol = typeof MetaSymbol;

export const ActionSymbol: unique symbol = Symbol("Action");
export type ActionSymbol = typeof ActionSymbol;

export const NamedDefinition: unique symbol = Symbol("NamedDefinition");
export type NamedDefinition = typeof NamedDefinition;

export type AllSymbols = {
  MetaSymbol: MetaSymbol;
  ActionSymbol: ActionSymbol;
  NamedDefinition: NamedDefinition;
};
