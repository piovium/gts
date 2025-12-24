import type { AttributeBlockDefinition, ViewModel } from "./view_model";

export interface SingleAttributeNode {
  name: string;
  positionals: any[];
  named: NamedAttributesNode | null;
}

type SingleAttributeViewFactory = () => SingleAttributeNode;

export interface NamedAttributesNode {
  attributes: SingleAttributeViewFactory[];
}

export interface Binding {
  scope: "public" | "private";
  name: string;
}

export interface BindingValue extends Binding {
  value: any;
}

export type Bindings = BindingValue[];

export class View<BlockDef extends AttributeBlockDefinition> {
  #phantom!: BlockDef;

  constructor(
    public _node: NamedAttributesNode,
    public _addBinding: (binding: BindingValue) => void
  ) {}
}

export function defineAttribute(
  rootVM: ViewModel<any, any>,
  factory: SingleAttributeViewFactory
): Bindings {
  const bindings: BindingValue[] = [];
  const view = new View<any>({ attributes: [factory] }, (binding) => {
    bindings.push(binding);
  });
  rootVM.parse(view);

  return bindings;
}
