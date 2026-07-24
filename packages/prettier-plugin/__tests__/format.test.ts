import * as prettier from "prettier";
import { expect, test } from "vitest";
import plugin from "../src/index.ts";

async function format(
  source: string,
  options?: prettier.Options,
): Promise<string> {
  return prettier.format(source, {
    parser: "gts",
    plugins: [plugin],
    ...options,
  });
}

async function formatByPath(source: string, filepath: string): Promise<string> {
  return prettier.format(source, {
    filepath,
    plugins: [plugin],
  });
}

test("selects parser for .gts files", async () => {
  await expect(formatByPath("define foo   bar;", "card.gts")).resolves.toBe(
    "define foo bar;\n",
  );
});

test("formats basic define statements", async () => {
  await expect(format("define character   hydro,catalyst;")).resolves.toBe(
    "define character hydro, catalyst;\n",
  );
});

test("removes empty named attribute blocks", async () => {
  await expect(format("define foo {\n};")).resolves.toBe("define foo;\n");
  await expect(format("define foo bar { };")).resolves.toBe(
    "define foo bar;\n",
  );
});

test("respects objectWrap for a single named attribute", async () => {
  await expect(format("define foo { bar 1; };")).resolves.toBe(
    "define foo { bar 1; };\n",
  );
  await expect(format("define foo {\nbar 1;\n};")).resolves.toBe(`define foo {
  bar 1;
};
`);
  await expect(
    format("define foo {\nbar 1;\n};", { objectWrap: "collapse" }),
  ).resolves.toBe("define foo { bar 1; };\n");
});

test("formats nested named attribute blocks", async () => {
  const source = `define summon {id 112011 as MelodyLoop;usage 2 {name not_a_usage;append {limit getLimit(5)?.value;value 1;};};};`;

  await expect(format(source)).resolves.toBe(`define summon {
  id 112011 as MelodyLoop;
  usage 2 {
    name not_a_usage;
    append {
      limit getLimit(5)?.value;
      value 1;
    };
  };
};
`);
});

test("formats direct action bodies", async () => {
  const source = `define skill {on endPhase {const currentUsage=:getVariable("usage");:damage(DamageType.Hydro,1,:query(:$.my.active));}};`;

  await expect(format(source)).resolves.toBe(`define skill {
  on endPhase {
    const currentUsage = :getVariable("usage");
    :damage(DamageType.Hydro, 1, :query(:$.my.active));
  };
};
`);
});

test("formats shortcut functions and member access", async () => {
  const source = `define summon {when :( !:$.my );check :{return :query(:$.my.active);};};`;

  await expect(format(source)).resolves.toBe(`define summon {
  when :( !:$.my );
  check :{
    return :query(:$.my.active);
  };
};
`);
});

test("formats shortcut function return types", async () => {
  const source = `define summon {when :<boolean>( !:$.my );check :<number>{return 1;};};`;

  await expect(format(source)).resolves.toBe(`define summon {
  when :<boolean>( !:$.my );
  check :<number>{
    return 1;
  };
};
`);
});

test("delegates TypeScript syntax to Prettier", async () => {
  const source = `const getLimit=(usage:number)=>{return {value:usage+1}};define foo getLimit(1)?.value;`;

  await expect(format(source)).resolves.toBe(`const getLimit = (usage: number) => {
  return { value: usage + 1 };
};
define foo getLimit(1)?.value;
`);
});

test("prints parenthesized TypeScript types", async () => {
  await expect(format("type Value = (string | number);")).resolves.toBe(
    "type Value = (string | number);\n",
  );
});

test("preserves parentheses required by positional attributes", async () => {
  const source = "define foo ((value)=>value),({value:1});";

  await expect(format(source)).resolves.toBe(
    "define foo ((value) => value), ({ value: 1 });\n",
  );
});

test("parenthesizes shortcut expressions used as arrow bodies", async () => {
  await expect(format("define foo :(() => (:bar));")).resolves.toBe(
    "define foo :( () => (:bar) );\n",
  );
});

test("formats string attribute names and binding modifiers", async () => {
  await expect(
    format(`define entity {"type" passive;id 1 as private Test;};`),
  ).resolves.toBe(`define entity {
  "type" passive;
  id 1 as private Test;
};
`);
});

test("preserves leading trailing and block comments", async () => {
  const source = `// leading
define character {
  /** identifier */
  id 1201 as Barbara; // trailing
  tags hydro, catalyst;
};`;

  await expect(format(source)).resolves.toBe(`// leading
define character {
  /** identifier */
  id 1201 as Barbara; // trailing
  tags hydro, catalyst;
};
`);
});

test("formats comment-only input", async () => {
  await expect(format("// comment only")).resolves.toBe("// comment only\n");
});

test("is idempotent", async () => {
  const source = `define summon {usage 2 {append {limit getLimit(5)?.value;value 1;};};on endPhase {:heal(1,:queryAll(:$.my.character));}};`;
  const once = await format(source);
  const twice = await format(once);

  expect(twice).toBe(once);
});
