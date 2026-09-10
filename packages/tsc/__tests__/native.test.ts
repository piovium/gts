import { spawnSync } from "node:child_process";
import path from "node:path";
import { expect, test } from "vitest";
import {
  brokenHealth,
  character,
  createFixture,
  legacySource,
  repository,
  unreferenced,
} from "../../language-server/__tests__/fixture.ts";

test("native gtsc checks included and imported GTS files and maps errors to source", () => {
  const fixture = createFixture();
  const runGtsc = (...args: string[]) => {
    const result = spawnSync(
      process.execPath,
      [
        path.join(repository, "packages/tsc/bin/gtsc.js"),
        "--noEmit",
        "--pretty",
        "false",
        "--project",
        path.join(fixture.directory, "tsconfig.json"),
        ...args,
      ],
      {
        cwd: fixture.directory,
        encoding: "utf8",
        timeout: 60000,
        env: { ...process.env, TSGO_PROFILE: "1" },
      },
    );
    expect(result.error).toBeUndefined();
    expect(result.signal).toBeNull();
    expect(result.stderr).not.toMatch(/panic:|Uncaught|heap out of memory/);
    expect(result.stderr).toContain("[tsgo-profile]");
    return result;
  };
  try {
    const valid = runGtsc("--listFiles");
    expect(valid.stdout).not.toContain("error TS");
    expect(valid.status).toBe(0);
    for (const file of [
      "current.gts",
      "old_versions.gts",
      "consumer.ts",
      "component.tsx",
      "isolated.gts",
    ]) {
      expect(valid.stdout.replaceAll("\\", "/")).toContain(`/${file}`);
    }
    fixture.write("current.gts", brokenHealth(character));
    const currentError = runGtsc();
    expect(currentError.status).toBe(2);
    expect(currentError.stdout).toMatch(
      /current\.gts\(6,10\): error TS2345:.*string.*number/,
    );
    fixture.write("current.gts", character);
    fixture.write("old_versions.gts", legacySource("string"));
    const importError = runGtsc();
    expect(importError.status).toBe(2);
    expect(importError.stdout).toMatch(
      /old_versions\.gts\(2,14\): error TS2322:/,
    );
    fixture.write("old_versions.gts", legacySource("number"));
    fixture.write("isolated.gts", brokenHealth(unreferenced(character)));
    const isolatedError = runGtsc();
    expect(isolatedError.status).toBe(2);
    expect(isolatedError.stdout).toMatch(
      /isolated\.gts\(6,10\): error TS2345:/,
    );
    fixture.write("isolated.gts", unreferenced(character));
    const repaired = runGtsc();
    expect(repaired.stdout).toBe("");
    expect(repaired.status).toBe(0);
  } finally {
    fixture.dispose();
  }
}, 240000);
