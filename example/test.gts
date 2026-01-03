// import { A } from "./test2.gts";

export const add = (a: number, b: number) => {
  return a + b;
}

/**
 * @id 1201
 * @name 芭芭拉
 * @description
 * 无论何时都能治愈人心。
 */
define character {
  id 1201 as Barbara;
  since "v3.3.0";
  tags hydro, catalyst, mondstadt;
  health 10;
  energy 3;
  skills WhisperOfWater;
  // variable "foo", 3;
}

/**
 * @id 12012
 * @name 演唱，开始♪
 * @description
 * 造成1点水元素伤害，召唤歌声之环。
 */
define skill {
  id 12011 as private WhisperOfWater;
  cost hydro, 3;
  :getVariable()
  :damage(hydro, 1);
  :summon(MelodyLoop);
}

/**
 * @id 112011
 * @name 歌声之环
 * @description
 * 结束阶段：治疗所有我方角色1点，然后对我方出战角色附着水元素。
 * 可用次数：2
 */
define summon {
  id 112011 as MelodyLoop;
  on endPhase {
    when :( true )
    usage 2;
    hint heal, 1;
    :heal(1, query* my.character);
    :apply(hydro, query my.active);
  }
}


const sub = (a: number, b: number) => {
  return a - b;
}

export const obj = {
  foo: "bar",
  sub: (name: string) => {}
};
obj.foo;
