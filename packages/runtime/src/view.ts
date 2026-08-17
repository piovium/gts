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
  #children = new WeakMap<SingleAttributeNode, View<any>>();
  _node: NamedAttributesNode;
  /** @deprecated Binding state is execution-scoped; retained for direct callers. */
  _bindingCtx?: BindingContext;

  constructor(
    _node: NamedAttributesNode,
    _bindingCtx?: BindingContext | undefined,
  ) {
    this._node = _node;
    this._bindingCtx = _bindingCtx;
  }

  _getChild(attribute: SingleAttributeNode): View<any> {
    let child = this.#children.get(attribute);
    if (!child) {
      child = new View(
        attribute.named ?? { attributes: [] },
        this._bindingCtx,
      );
      this.#children.set(attribute, child);
    }
    return child;
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

const rootViews = new WeakMap<SingleAttributeNode, View<any>>();

function getRootView(node: SingleAttributeNode): View<any> {
  let view = rootViews.get(node);
  if (!view) {
    view = new View<any>({ attributes: [node] });
    rootViews.set(node, view);
  }
  return view;
}

export function createDefine(
  rootVM: IViewModel<any, any, any>,
  node: SingleAttributeNode,
): void {
  runInViewModelExecution({ phase: "action" }, () => {
    rootVM.parse(getRootView(node));
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
      rootVM.parse(getRootView(node));
    },
  );
  return bindingCtx.getBindings();
}
