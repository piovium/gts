#!/usr/bin/env node
// Copyright (C) 2026 Piovium Labs
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as
// published by the Free Software Foundation, either version 3 of the
// License, or (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.

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
  // until "v3.4.0";
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
  variable foo, 2;
  const a = :getVariable("foo")
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
  // oops 3;
  usage 2 {
    appendLimit 6;
    appendCount 1;
  };
  on endPhase {
    when :( true )
    hint heal, 1;
    :heal(1, query* my.character);
    const currentUsage = :getVariable("usage");
    void (1 +1);
    class A {
      // This comment should be visible
      x = () => void :heal;
    }
    :apply(hydro, query my.active);
  }
}


const sub = (a: number, b: number) => {
  return a - b;
}

void A;
gytx
const obj = { sub, foo: 0 };

// obj.sub("test");
// (0, obj).sub("test");
// obj.foo ? 'a' : 'b';
// new Date().         
// sub

