export {
  defineViewModel,
  extendViewModel,
  getCurrentContext,
  type AttributeDefinition,
  type IViewModel,
  type IViewModelInstance,
  type IReboundViewModel as IBoundViewModel,
  type IExtendedViewModel,
  type SimpleAttributeOptions,
  type AttributeBlockDefinition,
} from "./view_model.ts";
export {
  defineSimpleViewModel,
  type ISimpleViewModel,
  type SimpleViewModelOptions,
} from "./simple_view_model.ts";
export type { AttributeReturn, AR } from "./attribute_return.ts";

export {
  createBinding,
  createDefine,
  type SingleAttributeNode,
  type NamedAttributesNode,
  type View,
} from "./view.ts";
