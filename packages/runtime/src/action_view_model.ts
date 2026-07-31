import {
  type AttributeDefinition,
  type AttributeDefHelper,
  defineViewModel,
  type IViewModel,
  type OverloadedParameters,
} from "./view_model.ts";
import type { AR } from "./attribute_return.ts";

type AnyAction = (fnArg: any) => void;

export class ActionModel<Fn extends AnyAction> {
  action!: Fn;
}

/**
 * Defines a ViewModel whose only attribute is a direct `~action` that assigned to `ActionModel`'s `action`.
 */
export function defineActionViewModel<
  Signature extends (this: any, actionArg: AnyAction) => AR.Done,
  InitMeta = unknown,
  ModelActionSig extends AnyAction = OverloadedParameters<Signature>[0],
>(): IViewModel<
  ActionModel<ModelActionSig>,
  {
    "~action": Signature & {
      required(): true;
    };
    "~meta": InitMeta;
  },
  []
> {
  return defineViewModel(
    ActionModel<ModelActionSig>,
    (helper) => ({
      "~action": helper.attribute<Signature & { required(): true }>(
        (model, [actionArg]) => {
          model.action = actionArg as ModelActionSig;
        },
      ),
    }),
    null as InitMeta,
  );
}

type Operation<Meta> = (arg: { meta: Meta }) => void;

const VM =
  defineActionViewModel<
    <Meta>(this: AR.This<Meta>, op: Operation<Meta>) => AR.Done
  >();
