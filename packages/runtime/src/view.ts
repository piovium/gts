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

const bindingStore: WeakMap<SingleAttributeNode, unknown[]> = new WeakMap();

export class View<BlockDef extends AttributeBlockDefinition> {
  #phantom!: BlockDef;

  constructor(
    public _node: NamedAttributesNode,
    /** Optional binding output slots (in traversal order) */
    public _bindings?: unknown[]
  ) {}
}

export function createDefine(
  rootVM: ViewModel<any, any>,
  node: SingleAttributeNode
): void {
  const bindings = bindingStore.get(node);
  if (bindings) {
    bindingStore.delete(node);
  }
  const view = new View<any>({ attributes: [node] }, bindings);
  rootVM.parse(view);
}

export function createBinding(
  _rootVM: ViewModel<any, any>,
  node: SingleAttributeNode
): unknown[] {
  const bindings: unknown[] = new Array(countBindings(node));
  bindingStore.set(node, bindings);
  return bindings;
}

function countBindings(node: SingleAttributeNode): number {
  let count = node.binding ? 1 : 0;
  if (node.named) {
    for (const child of node.named.attributes) {
      count += countBindings(child);
    }
  }
  return count;
}
