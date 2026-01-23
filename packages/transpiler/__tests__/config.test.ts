import { beforeEach, describe, expect, it, vi } from "vitest";
import { vol } from "memfs";
import {
  resolveGtsConfig,
  resolveGtsConfigAsync,
} from "../src/config";

vi.mock("node:fs", () => ({
  default: vol,
}));

describe("resolveGtsConfig", () => {
  beforeEach(() => {
    vol.reset();
  });
  it("should return default config if no package.json is found", () => {
    vol.fromJSON({});
    const config = resolveGtsConfig("/a/b/c/d.gts", undefined, {
      readFileFn: (path, encoding) => {
        if (vol.existsSync(path)) {
          return vol.readFileSync(path, encoding) as string;
        }
        throw new Error("File not found");
      },
    });
    expect(config).toMatchSnapshot();
  });
  it("should return config from nearest package.json", () => {
    vol.fromJSON({
      "/a/b/package.json": JSON.stringify({
        name: "test",
        gamingTs: {
          runtimeImportSource: "test-runtime",
        },
      }),
    });
    const config = resolveGtsConfig("/a/b/c/d.gts", undefined, {
      readFileFn: (path, encoding) => {
        if (vol.existsSync(path)) {
          return vol.readFileSync(path, encoding) as string;
        }
        throw new Error("File not found");
      },
    });
    expect(config.runtimeImportSource).toBe("test-runtime");
  });
});

describe("resolveGtsConfigAsync", () => {
  beforeEach(() => {
    vol.reset();
  });
  it("should return default config if no package.json is found", async () => {
    vol.fromJSON({});
    const config = await resolveGtsConfigAsync("/a/b/c/d.gts", undefined, {
      readFileFn: async (path, encoding) => {
        if (vol.existsSync(path)) {
          return vol.readFileSync(path, encoding) as string;
        }
        throw new Error("File not found");
      },
    });
    expect(config).toMatchSnapshot();
  });
  it("should return config from nearest package.json", async () => {
    vol.fromJSON({
      "/a/b/package.json": JSON.stringify({
        name: "test",
        gamingTs: {
          runtimeImportSource: "test-runtime",
        },
      }),
    });
    const config = await resolveGtsConfigAsync("/a/b/c/d.gts", undefined, {
      readFileFn: async (path, encoding) => {
        if (vol.existsSync(path)) {
          return vol.readFileSync(path, encoding) as string;
        }
        throw new Error("File not found");
      },
    });
    expect(config.runtimeImportSource).toBe("test-runtime");
  });
});
