# GamingTS

![Gaming](https://static.wikia.nocookie.net/gensin-impact/images/4/48/Icon_Emoji_Paimon%27s_Paintings_30_Gaming_4.png/revision/latest?cb=20240207044116)

A TypeScript extension for writing Genius Invokation TCG cards.

## A Quick Glance

```ts
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
  
  /**
   * @id 12012
   * @name 演唱，开始♪
   * @description
   * 造成1点水元素伤害，召唤歌声之环。
   */
  skill {
    id 12011 as WhisperOfWater;
    cost hydro, 3;
    ^damage(hydro, 1);
    ^summon(MelodyLoop);
  }
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
    usage 2;
    hint heal, 1;
    ^heal(1, query my.characters);
    ^apply(hydro, query my.active);
  }
}
```
