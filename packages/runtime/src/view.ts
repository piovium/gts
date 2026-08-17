import type { AttributeBlockDefinition, IViewModel } from "./view_model.ts";
import { runInViewModelExecution } from "./execution_context.ts";

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
  "~node": NamedAttributesNode;

  constructor(node: NamedAttributesNode) {
    this["~node"] = node;
  }
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

interface RegisteredViews {
  root?: View<any>;
  named?: View<any>;
}

const viewRegistry = new WeakMap<SingleAttributeNode, RegisteredViews>();

export function getViewForNode(
  node: SingleAttributeNode,
  kind: "root" | "named",
): View<any> {
  let registered = viewRegistry.get(node);
  if (!registered) {
    registered = {};
    viewRegistry.set(node, registered);
  }
  let view = registered[kind];
  if (!view) {
    view = new View<any>(
      kind === "root"
        ? { attributes: [node] }
        : (node.named ?? { attributes: [] }),
    );
    registered[kind] = view;
  }
  return view;
}

export function createDefine(
  rootVM: IViewModel<any, any, any>,
  node: SingleAttributeNode,
): void {
  runInViewModelExecution({ phase: "action" }, () => {
    rootVM.parse(getViewForNode(node, "root"));
  });
}

export function createBinding(
  rootVM: IViewModel<any, any, any>,
  node: SingleAttributeNode,
): unknown[] {
  const bindingCtx = new BindingContext();
  runInViewModelExecution(
    { phase: "binder", bindingContext: bindingCtx },
    () => {
      rootVM.parse(getViewForNode(node, "root"));
    },
  );
  return bindingCtx.getBindings();
}
