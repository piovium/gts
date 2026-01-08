import type { AttributeBlockDefinition, ViewModel } from "./view_model";

export type AttributeName = string | symbol;

export interface SingleAttributeNode {
  name: AttributeName;
  /** Lazy evaluation: only evaluate positional expressions when traversing */
  positionals: () => any[];
  named: NamedAttributesNode | null;
  /** Marks this attribute as a binding export candidate */
  binding?: "public" | "private";
}

export interface NamedAttributesNode {
  attributes: SingleAttributeNode[];
}

export class View<BlockDef extends AttributeBlockDefinition> {
  #phantom!: BlockDef;

  constructor(
    public _node: NamedAttributesNode,
    public _bindingCtx?: BindingContext,
  ) {}
}

export class BindingContext {
  #bindings: unknown[] = [];
  addBinding(value: unknown): void {
    this.#bindings.push(value);
  }
  getBindings(): unknown[] {
    return this.#bindings;
  }
}

export function createDefine(
  rootVM: ViewModel<any, any>,
  node: SingleAttributeNode
): void {
  const view = new View<any>({ attributes: [node] });
  rootVM.parse(view);
}

export function createBinding(
  rootVM: ViewModel<any, any>,
  node: SingleAttributeNode
): unknown[] {
  const bindingCtx = new BindingContext();
  const view = new View<any>({ attributes: [node] }, bindingCtx);
  rootVM.parse(view);
  return bindingCtx.getBindings();
}
