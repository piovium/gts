import __gts_query from '@example/provider/query';
import __root_vm from '@example/provider/vm';

/**
 * @id 112011
 * @name 歌声之环
 * @description
 * 结束阶段：治疗所有我方角色1点，然后对我方出战角色附着水元素。
 * 可用次数：2
 */
export const MelodyLoop: gts_binding_type_2 = 0 as any;

/**
 * @id 12012
 * @name 演唱，开始♪
 * @description
 * 造成1点水元素伤害，召唤歌声之环。
 */
const WhisperOfWater: gts_binding_type_1 = 0 as any;

/**
 * @id 1201
 * @name 芭芭拉
 * @description
 * 无论何时都能治愈人心。
 */
export const Barbara: gts_binding_type_0 = 0 as any;

import { A } from "./test2.gts";

export const add = (a: number, b: number) => {
  return a + b;
};

type __gts_symbols_meta = typeof __root_vm['~symbols']['Meta'];

const __gts_symbols_meta: __gts_symbols_meta = 0 as any;

type __gts_Action = typeof __root_vm['~symbols']['Action'];

const __gts_Action: __gts_Action = 0 as any;

type __gts_symbols_namedDef = typeof __root_vm['~symbols']['NamedDefinition'];

const __gts_symbols_namedDef: __gts_symbols_namedDef = 0 as any;

type __gts_Prelude = typeof __root_vm['~symbols']['Prelude'];

const __gts_Prelude: __gts_Prelude = 0 as any;

type __gts_rootVmDefType_0 = (typeof __root_vm)[__gts_symbols_namedDef]; type __gts_rootVmInitMetaType_1 = __gts_rootVmDefType_0[__gts_symbols_meta];;
const __gts_attr_obj_3: { [__gts_symbols_meta]: __gts_rootVmInitMetaType_1 } & Omit<__gts_rootVmDefType_0, __gts_symbols_meta> = 0 as any;;

const __gts_attrRet_4 = __gts_attr_obj_3.character();

type __gts_nestedVm_5 = __gts_attrRet_4 extends { namedDefinition: infer Def } ? Def : { [__gts_symbols_meta]: unknown }; type __gts_nestedVmInitMetaType_6 = __gts_nestedVm_5[__gts_symbols_meta];;
const __gts_attr_obj_8: { [__gts_symbols_meta]: __gts_nestedVmInitMetaType_6 } & Omit<__gts_nestedVm_5, __gts_symbols_meta> = 0 as any;;

const __gts_attrRet_9 = __gts_attr_obj_8.id(1201);

type gts_binding_type_0_lhs = { [__gts_symbols_meta]: __gts_nestedVmFinalMetaType_7; as: __gts_nestedVm_5["id"] extends { as: infer As } ? As : unknown }; let gts_binding_type_0_lhs!: gts_binding_type_0_lhs; let gts_binding_type_0 = gts_binding_type_0_lhs.as(); type gts_binding_type_0 = typeof gts_binding_type_0;;
type __gts_attrRet_9 = typeof __gts_attrRet_9; type __gts_newMeta__10 = __gts_attrRet_9 extends { rewriteMeta: infer NewMeta extends {} } ? NewMeta : __gts_nestedVmInitMetaType_6;
const __gts_attr_obj_11: { [__gts_symbols_meta]: __gts_newMeta__10 } & Omit<__gts_nestedVm_5, __gts_symbols_meta> = 0 as any;;

const __gts_attrRet_12 = __gts_attr_obj_11.since("v3.3.0");

type __gts_attrRet_12 = typeof __gts_attrRet_12; type __gts_newMeta__13 = __gts_attrRet_12 extends { rewriteMeta: infer NewMeta extends {} } ? NewMeta : __gts_newMeta__10;
const __gts_attr_obj_14: { [__gts_symbols_meta]: __gts_newMeta__13 } & Omit<__gts_nestedVm_5, __gts_symbols_meta> = 0 as any;;

const __gts_attrRet_15 = __gts_attr_obj_14.tags('hydro', 'catalyst', 'mondstadt');

type __gts_attrRet_15 = typeof __gts_attrRet_15; type __gts_newMeta__16 = __gts_attrRet_15 extends { rewriteMeta: infer NewMeta extends {} } ? NewMeta : __gts_newMeta__13;
const __gts_attr_obj_17: { [__gts_symbols_meta]: __gts_newMeta__16 } & Omit<__gts_nestedVm_5, __gts_symbols_meta> = 0 as any;;

const __gts_attrRet_18 = __gts_attr_obj_17.health(10);

type __gts_attrRet_18 = typeof __gts_attrRet_18; type __gts_newMeta__19 = __gts_attrRet_18 extends { rewriteMeta: infer NewMeta extends {} } ? NewMeta : __gts_newMeta__16;
const __gts_attr_obj_20: { [__gts_symbols_meta]: __gts_newMeta__19 } & Omit<__gts_nestedVm_5, __gts_symbols_meta> = 0 as any;;

const __gts_attrRet_21 = __gts_attr_obj_20.energy(3);

type __gts_attrRet_21 = typeof __gts_attrRet_21; type __gts_newMeta__22 = __gts_attrRet_21 extends { rewriteMeta: infer NewMeta extends {} } ? NewMeta : __gts_newMeta__19;
const __gts_attr_obj_23: { [__gts_symbols_meta]: __gts_newMeta__22 } & Omit<__gts_nestedVm_5, __gts_symbols_meta> = 0 as any;;

const __gts_attrRet_24 = __gts_attr_obj_23.skills(WhisperOfWater);

type __gts_attrRet_24 = typeof __gts_attrRet_24; type __gts_newMeta__25 = __gts_attrRet_24 extends { rewriteMeta: infer NewMeta extends {} } ? NewMeta : __gts_newMeta__22;
type __gts_nestedVmFinalMetaType_7 = __gts_newMeta__25; const __gts_nestedVmFinalMetaType_7_lhs: { [__gts_symbols_meta]: __gts_newMeta__25 } & Omit<__gts_nestedVm_5, __gts_symbols_meta> = 0 as any; type __gts_nestedVmFinalMetaType_7_lhs = typeof __gts_nestedVmFinalMetaType_7_lhs; namespace __gts_nestedVmFinalMetaType_7_rans { export type Collected = "id" | "since" | "tags" | "health" | "energy" | "skills"; export type Expected = { [K in keyof __gts_nestedVm_5]: __gts_nestedVmFinalMetaType_7_lhs[K] extends { required(this: __gts_nestedVmFinalMetaType_7_lhs): true } ? K : never }[keyof __gts_nestedVm_5]; }; ((_: __gts_nestedVmFinalMetaType_7_rans.Expected extends __gts_nestedVmFinalMetaType_7_rans.Collected ? string : __gts_nestedVmFinalMetaType_7_rans.Expected) => 0)("__gts_nestedVmFinalMetaType_7_rans_NeedleString" as any as "required attributes are missing");;
type __gts_attrRet_4 = typeof __gts_attrRet_4; type __gts_newMeta__26 = __gts_attrRet_4 extends { rewriteMeta: infer NewMeta extends {} } ? NewMeta : __gts_rootVmInitMetaType_1;
type __gts_rootVmFinalMetaType_2 = __gts_newMeta__26; const __gts_rootVmFinalMetaType_2_lhs: { [__gts_symbols_meta]: __gts_newMeta__26 } & Omit<__gts_rootVmDefType_0, __gts_symbols_meta> = 0 as any; type __gts_rootVmFinalMetaType_2_lhs = typeof __gts_rootVmFinalMetaType_2_lhs; namespace __gts_rootVmFinalMetaType_2_rans { export type Collected = "character"; export type Expected = { [K in keyof __gts_rootVmDefType_0]: __gts_rootVmFinalMetaType_2_lhs[K] extends { required(this: __gts_rootVmFinalMetaType_2_lhs): true } ? K : never }[keyof __gts_rootVmDefType_0]; }; ((_: __gts_rootVmFinalMetaType_2_rans.Expected extends __gts_rootVmFinalMetaType_2_rans.Collected ? string : __gts_rootVmFinalMetaType_2_rans.Expected) => 0)("__gts_rootVmFinalMetaType_2_rans_NeedleString" as any as "required attributes are missing");;
type __gts_rootVmDefType_27 = (typeof __root_vm)[__gts_symbols_namedDef]; type __gts_rootVmInitMetaType_28 = __gts_rootVmDefType_27[__gts_symbols_meta];;
const __gts_attr_obj_30: { [__gts_symbols_meta]: __gts_rootVmInitMetaType_28 } & Omit<__gts_rootVmDefType_27, __gts_symbols_meta> = 0 as any;;

const __gts_attrRet_31 = __gts_attr_obj_30.skill();

type __gts_nestedVm_32 = __gts_attrRet_31 extends { namedDefinition: infer Def } ? Def : { [__gts_symbols_meta]: unknown }; type __gts_nestedVmInitMetaType_33 = __gts_nestedVm_32[__gts_symbols_meta];;
const __gts_attr_obj_35: { [__gts_symbols_meta]: __gts_nestedVmInitMetaType_33 } & Omit<__gts_nestedVm_32, __gts_symbols_meta> = 0 as any;;

const __gts_attrRet_36 = __gts_attr_obj_35.id(12011);

type gts_binding_type_1_lhs = { [__gts_symbols_meta]: __gts_nestedVmFinalMetaType_34; as: __gts_nestedVm_32["id"] extends { as: infer As } ? As : unknown }; let gts_binding_type_1_lhs!: gts_binding_type_1_lhs; let gts_binding_type_1 = gts_binding_type_1_lhs.as(); type gts_binding_type_1 = typeof gts_binding_type_1;;
type __gts_attrRet_36 = typeof __gts_attrRet_36; type __gts_newMeta__37 = __gts_attrRet_36 extends { rewriteMeta: infer NewMeta extends {} } ? NewMeta : __gts_nestedVmInitMetaType_33;
const __gts_attr_obj_38: { [__gts_symbols_meta]: __gts_newMeta__37 } & Omit<__gts_nestedVm_32, __gts_symbols_meta> = 0 as any;;

const __gts_attrRet_39 = __gts_attr_obj_38.cost('hydro', 3);

type __gts_attrRet_39 = typeof __gts_attrRet_39; type __gts_newMeta__40 = __gts_attrRet_39 extends { rewriteMeta: infer NewMeta extends {} } ? NewMeta : __gts_newMeta__37;
const __gts_attr_obj_41: { [__gts_symbols_meta]: __gts_newMeta__40 } & Omit<__gts_nestedVm_32, __gts_symbols_meta> = 0 as any;;

const __gts_attrRet_42 = __gts_attr_obj_41.variable('foo', 42);

type __gts_attrRet_42 = typeof __gts_attrRet_42; type __gts_newMeta__43 = __gts_attrRet_42 extends { rewriteMeta: infer NewMeta extends {} } ? NewMeta : __gts_newMeta__40;
const __gts_attr_obj_44: { [__gts_symbols_meta]: __gts_newMeta__43 } & Omit<__gts_nestedVm_32, __gts_symbols_meta> = 0 as any;;

const __gts_attrRet_45 = __gts_attr_obj_44[__gts_Action]((
  __gts_fnArg,
  { cryo, hydro, pyro, electro, anemo, geo, dendro, omni } = __gts_fnArg[__gts_Prelude]
) => {
  const a = __gts_fnArg.getVariable("foo");

  __gts_fnArg.;
  __gts_fnArg.damage(hydro, 1);
  __gts_fnArg.summon(MelodyLoop);
});

type __gts_nestedVmFinalMetaType_34 = __gts_newMeta__43; const __gts_nestedVmFinalMetaType_34_lhs: { [__gts_symbols_meta]: __gts_newMeta__43 } & Omit<__gts_nestedVm_32, __gts_symbols_meta> = 0 as any; type __gts_nestedVmFinalMetaType_34_lhs = typeof __gts_nestedVmFinalMetaType_34_lhs; namespace __gts_nestedVmFinalMetaType_34_rans { export type Collected = "id" | "cost" | "variable" | __gts_Action; export type Expected = { [K in keyof __gts_nestedVm_32]: __gts_nestedVmFinalMetaType_34_lhs[K] extends { required(this: __gts_nestedVmFinalMetaType_34_lhs): true } ? K : never }[keyof __gts_nestedVm_32]; }; ((_: __gts_nestedVmFinalMetaType_34_rans.Expected extends __gts_nestedVmFinalMetaType_34_rans.Collected ? string : __gts_nestedVmFinalMetaType_34_rans.Expected) => 0)("__gts_nestedVmFinalMetaType_34_rans_NeedleString" as any as "required attributes are missing");;
type __gts_attrRet_31 = typeof __gts_attrRet_31; type __gts_newMeta__46 = __gts_attrRet_31 extends { rewriteMeta: infer NewMeta extends {} } ? NewMeta : __gts_rootVmInitMetaType_28;
type __gts_rootVmFinalMetaType_29 = __gts_newMeta__46; const __gts_rootVmFinalMetaType_29_lhs: { [__gts_symbols_meta]: __gts_newMeta__46 } & Omit<__gts_rootVmDefType_27, __gts_symbols_meta> = 0 as any; type __gts_rootVmFinalMetaType_29_lhs = typeof __gts_rootVmFinalMetaType_29_lhs; namespace __gts_rootVmFinalMetaType_29_rans { export type Collected = "skill"; export type Expected = { [K in keyof __gts_rootVmDefType_27]: __gts_rootVmFinalMetaType_29_lhs[K] extends { required(this: __gts_rootVmFinalMetaType_29_lhs): true } ? K : never }[keyof __gts_rootVmDefType_27]; }; ((_: __gts_rootVmFinalMetaType_29_rans.Expected extends __gts_rootVmFinalMetaType_29_rans.Collected ? string : __gts_rootVmFinalMetaType_29_rans.Expected) => 0)("__gts_rootVmFinalMetaType_29_rans_NeedleString" as any as "required attributes are missing");;
type __gts_rootVmDefType_47 = (typeof __root_vm)[__gts_symbols_namedDef]; type __gts_rootVmInitMetaType_48 = __gts_rootVmDefType_47[__gts_symbols_meta];;
const __gts_attr_obj_50: { [__gts_symbols_meta]: __gts_rootVmInitMetaType_48 } & Omit<__gts_rootVmDefType_47, __gts_symbols_meta> = 0 as any;;

const __gts_attrRet_51 = __gts_attr_obj_50.summon();

type __gts_nestedVm_52 = __gts_attrRet_51 extends { namedDefinition: infer Def } ? Def : { [__gts_symbols_meta]: unknown }; type __gts_nestedVmInitMetaType_53 = __gts_nestedVm_52[__gts_symbols_meta];;
const __gts_attr_obj_55: { [__gts_symbols_meta]: __gts_nestedVmInitMetaType_53 } & Omit<__gts_nestedVm_52, __gts_symbols_meta> = 0 as any;;

const __gts_attrRet_56 = __gts_attr_obj_55.id(112011);

type gts_binding_type_2_lhs = { [__gts_symbols_meta]: __gts_nestedVmFinalMetaType_54; as: __gts_nestedVm_52["id"] extends { as: infer As } ? As : unknown }; let gts_binding_type_2_lhs!: gts_binding_type_2_lhs; let gts_binding_type_2 = gts_binding_type_2_lhs.as(); type gts_binding_type_2 = typeof gts_binding_type_2;;
type __gts_attrRet_56 = typeof __gts_attrRet_56; type __gts_newMeta__57 = __gts_attrRet_56 extends { rewriteMeta: infer NewMeta extends {} } ? NewMeta : __gts_nestedVmInitMetaType_53;
const __gts_attr_obj_58: { [__gts_symbols_meta]: __gts_newMeta__57 } & Omit<__gts_nestedVm_52, __gts_symbols_meta> = 0 as any;;

const __gts_attrRet_59 = __gts_attr_obj_58.usage(2);

type __gts_attrRet_59 = typeof __gts_attrRet_59; type __gts_newMeta__60 = __gts_attrRet_59 extends { rewriteMeta: infer NewMeta extends {} } ? NewMeta : __gts_newMeta__57;
const __gts_attr_obj_61: { [__gts_symbols_meta]: __gts_newMeta__60 } & Omit<__gts_nestedVm_52, __gts_symbols_meta> = 0 as any;;

const __gts_attrRet_62 = __gts_attr_obj_61.on('endPhase');

type __gts_nestedVm_63 = __gts_attrRet_62 extends { namedDefinition: infer Def } ? Def : { [__gts_symbols_meta]: unknown }; type __gts_nestedVmInitMetaType_64 = __gts_nestedVm_63[__gts_symbols_meta];;
const __gts_attr_obj_66: { [__gts_symbols_meta]: __gts_nestedVmInitMetaType_64 } & Omit<__gts_nestedVm_63, __gts_symbols_meta> = 0 as any;;

const __gts_attrRet_67 = __gts_attr_obj_66.when((
  __gts_fnArg,
  { cryo, hydro, pyro, electro, anemo, geo, dendro, omni } = __gts_fnArg[__gts_Prelude]
) => true);

type __gts_attrRet_67 = typeof __gts_attrRet_67; type __gts_newMeta__68 = __gts_attrRet_67 extends { rewriteMeta: infer NewMeta extends {} } ? NewMeta : __gts_nestedVmInitMetaType_64;
const __gts_attr_obj_69: { [__gts_symbols_meta]: __gts_newMeta__68 } & Omit<__gts_nestedVm_63, __gts_symbols_meta> = 0 as any;;

const __gts_attrRet_70 = __gts_attr_obj_69.hint('heal', 1);

type __gts_attrRet_70 = typeof __gts_attrRet_70; type __gts_newMeta__71 = __gts_attrRet_70 extends { rewriteMeta: infer NewMeta extends {} } ? NewMeta : __gts_newMeta__68;
const __gts_attr_obj_72: { [__gts_symbols_meta]: __gts_newMeta__71 } & Omit<__gts_nestedVm_63, __gts_symbols_meta> = 0 as any;;

const __gts_attrRet_73 = __gts_attr_obj_72[__gts_Action]((
  __gts_fnArg,
  { cryo, hydro, pyro, electro, anemo, geo, dendro, omni } = __gts_fnArg[__gts_Prelude]
) => {
  __gts_fnArg.heal(1, __gts_query(({ my, opp }) => my.character, { star: true }));

  const currentUsage = __gts_fnArg.getVariable("usage");

  __gts_fnArg.apply(hydro, __gts_query(({ my, opp }) => my.active, { star: false }));
});

type __gts_nestedVmFinalMetaType_65 = __gts_newMeta__71; const __gts_nestedVmFinalMetaType_65_lhs: { [__gts_symbols_meta]: __gts_newMeta__71 } & Omit<__gts_nestedVm_63, __gts_symbols_meta> = 0 as any; type __gts_nestedVmFinalMetaType_65_lhs = typeof __gts_nestedVmFinalMetaType_65_lhs; namespace __gts_nestedVmFinalMetaType_65_rans { export type Collected = "when" | "hint" | __gts_Action; export type Expected = { [K in keyof __gts_nestedVm_63]: __gts_nestedVmFinalMetaType_65_lhs[K] extends { required(this: __gts_nestedVmFinalMetaType_65_lhs): true } ? K : never }[keyof __gts_nestedVm_63]; }; ((_: __gts_nestedVmFinalMetaType_65_rans.Expected extends __gts_nestedVmFinalMetaType_65_rans.Collected ? string : __gts_nestedVmFinalMetaType_65_rans.Expected) => 0)("__gts_nestedVmFinalMetaType_65_rans_NeedleString" as any as "required attributes are missing");;
type __gts_attrRet_62 = typeof __gts_attrRet_62; type __gts_newMeta__74 = __gts_attrRet_62 extends { rewriteMeta: infer NewMeta extends {} } ? NewMeta : __gts_newMeta__60;
type __gts_nestedVmFinalMetaType_54 = __gts_newMeta__74; const __gts_nestedVmFinalMetaType_54_lhs: { [__gts_symbols_meta]: __gts_newMeta__74 } & Omit<__gts_nestedVm_52, __gts_symbols_meta> = 0 as any; type __gts_nestedVmFinalMetaType_54_lhs = typeof __gts_nestedVmFinalMetaType_54_lhs; namespace __gts_nestedVmFinalMetaType_54_rans { export type Collected = "id" | "usage" | "on"; export type Expected = { [K in keyof __gts_nestedVm_52]: __gts_nestedVmFinalMetaType_54_lhs[K] extends { required(this: __gts_nestedVmFinalMetaType_54_lhs): true } ? K : never }[keyof __gts_nestedVm_52]; }; ((_: __gts_nestedVmFinalMetaType_54_rans.Expected extends __gts_nestedVmFinalMetaType_54_rans.Collected ? string : __gts_nestedVmFinalMetaType_54_rans.Expected) => 0)("__gts_nestedVmFinalMetaType_54_rans_NeedleString" as any as "required attributes are missing");;
type __gts_attrRet_51 = typeof __gts_attrRet_51; type __gts_newMeta__75 = __gts_attrRet_51 extends { rewriteMeta: infer NewMeta extends {} } ? NewMeta : __gts_rootVmInitMetaType_48;
type __gts_rootVmFinalMetaType_49 = __gts_newMeta__75; const __gts_rootVmFinalMetaType_49_lhs: { [__gts_symbols_meta]: __gts_newMeta__75 } & Omit<__gts_rootVmDefType_47, __gts_symbols_meta> = 0 as any; type __gts_rootVmFinalMetaType_49_lhs = typeof __gts_rootVmFinalMetaType_49_lhs; namespace __gts_rootVmFinalMetaType_49_rans { export type Collected = "summon"; export type Expected = { [K in keyof __gts_rootVmDefType_47]: __gts_rootVmFinalMetaType_49_lhs[K] extends { required(this: __gts_rootVmFinalMetaType_49_lhs): true } ? K : never }[keyof __gts_rootVmDefType_47]; }; ((_: __gts_rootVmFinalMetaType_49_rans.Expected extends __gts_rootVmFinalMetaType_49_rans.Collected ? string : __gts_rootVmFinalMetaType_49_rans.Expected) => 0)("__gts_rootVmFinalMetaType_49_rans_NeedleString" as any as "required attributes are missing");;

const sub = (a: number, b: number) => {
  return a - b;
};

export const obj = { foo: "bar", sub: (name: string) => {} }; // obj.sub("test");

// (0, obj).sub("test");
obj.foo ? 'a' : 'b';

new Date();