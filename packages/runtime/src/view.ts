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

  constructor(public _node: NamedAttributesNode) {}
}

export function createDefine(
  rootVM: ViewModel<any, any>,
  node: { attributes: [SingleAttributeViewFactory] }
): void {
  const view = new View<any>(node);
  rootVM.parse(view);
}
