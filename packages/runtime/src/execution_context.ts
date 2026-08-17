import type { BindingContext, View } from "./view.ts";

export type RuntimePhase = "action" | "binder";

/**
 * The ViewModel execution state visible while a Model is being constructed.
 *
 * The context is synchronous and scoped to the current `parse()` call. A View
 * is stable across the binder and action passes for the same definition, while
 * `phase` describes the current pass.
 */
export interface ModelConstructionContext {
  readonly view: View<any>;
  readonly phase: RuntimePhase;
}

interface ViewModelExecution {
  readonly phase: RuntimePhase;
  readonly bindingContext?: BindingContext;
}

let currentExecution: ViewModelExecution | null = null;
let currentModelContext: ModelConstructionContext | null = null;

/** Returns the context for the current synchronous ViewModel parse call. */
export function getCurrentModelContext(): ModelConstructionContext | null {
  return currentModelContext;
}

/** Returns the View currently being parsed, or `null` outside ViewModel parsing. */
export function getCurrentView(): View<any> | null {
  return currentModelContext?.view ?? null;
}

/** Returns whether the current ViewModel parse is running actions or binders. */
export function getCurrentContext(): RuntimePhase | null {
  return currentModelContext?.phase ?? null;
}

export function getCurrentViewModelExecution(): ViewModelExecution | null {
  return currentExecution;
}

export function runInViewModelExecution<T>(
  execution: ViewModelExecution,
  callback: () => T,
): T {
  const previousExecution = currentExecution;
  currentExecution = execution;
  try {
    return callback();
  } finally {
    currentExecution = previousExecution;
  }
}

export function runWithCurrentView<T>(view: View<any>, callback: () => T): T {
  const previousModelContext = currentModelContext;
  currentModelContext = {
    view,
    phase: currentExecution?.phase ?? "action",
  };
  try {
    return callback();
  } finally {
    currentModelContext = previousModelContext;
  }
}
