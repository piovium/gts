import { parse, parseLoose } from "../src/parse";
import { test, expect } from "bun:test";

test("basic test", () => {
  const source = `

define entity {
  id 211011 as MyEntity;
  on endPhase {
    usage 3 { appendTo 5 };
    hint Cryo, 2;
  }
  on useSkill {
    when :( :player.hands.length > 0 )
    usagePerRound 1
    :damage(Cryo, 1, query opp.next)
  } as private _;
  on selfDispose {
    when :{
      const chs = query* my.character;
      return chs.length >= 2;
    }
    if (add(1, 2) > 2) {
      :dispose(:self);
    }
  }
}

function add(a: number, b: number): number {
  return a + b;
}
`;
  const ast = parse(source);
  expect(ast.type).toBe("Program");
  expect(ast.body.length).toBe(2);
  expect(ast.body[0].type as string).toBe("GTSDefineStatement");
  // Bun.write("gts-parser-basic-test-ast.json", JSON.stringify(ast, null, 2));
});
