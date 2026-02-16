import type { TranspileOption } from "./transform/gts";

const path = globalThis.require
  ? (globalThis.require("node:path") as typeof import("node:path"))
  : {
      isAbsolute(filePath: string): boolean {
        return filePath.startsWith("/");
      },
      dirname(filePath: string): string {
        if (!filePath) {
          return ".";
        }
        const normalized = normalizeSlashes(filePath);
        if (normalized === "/") {
          return "/";
        }
        const trimmed =
          normalized.length > 1 && normalized.endsWith("/")
            ? normalized.slice(0, -1)
            : normalized;
        const idx = trimmed.lastIndexOf("/");
        if (idx < 0) {
          return ".";
        }
        if (idx === 0) {
          return "/";
        }
        return trimmed.slice(0, idx);
      },
      resolve(...segments: string[]): string {
        if (segments.length === 0) {
          return ".";
        }
        let resolved = "";
        for (let i = segments.length - 1; i >= 0; i--) {
          const segment = segments[i];
          if (!segment) {
            continue;
          }
          if (resolved) {
            resolved = `${segment}/${resolved}`;
          } else {
            resolved = segment;
          }
          if (path.isAbsolute(segment)) {
            break;
          }
        }
        return normalizeResolvedPath(resolved || ".");
      },
    };

function normalizeSlashes(filePath: string): string {
  return filePath.replace(/\\+/g, "/");
}

function normalizeResolvedPath(filePath: string): string {
  const normalized = normalizeSlashes(filePath);
  const isAbsolute = normalized.startsWith("/");
  const parts = normalized.split("/");
  const stack: string[] = [];
  for (const part of parts) {
    if (!part || part === ".") {
      continue;
    }
    if (part === "..") {
      if (stack.length > 0 && stack[stack.length - 1] !== "..") {
        stack.pop();
      } else if (!isAbsolute) {
        stack.push("..");
      }
      continue;
    }
    stack.push(part);
  }
  if (isAbsolute) {
    return `/${stack.join("/")}` || "/";
  }
  return stack.join("/") || ".";
}

export interface GtsConfig extends TranspileOption {}

export interface PackageJson {
  gamingTs?: GtsConfig;
}

type ReadFileFn = (path: string, encoding: "utf8") => string;
type ReadFileAsyncFn = (path: string, encoding: "utf8") => Promise<string>;

export interface ResolveGtsConfigSyncOptions {
  readFileFn: ReadFileFn;
  cwd?: string;
  stopDir?: string;
}

export interface ResolveGtsConfigAsyncOptions {
  readFileFn: ReadFileAsyncFn;
  cwd?: string;
  stopDir?: string;
}

const DEFAULT_GTS_CONFIG: Required<GtsConfig> = {
  runtimeImportSource: "@gi-tcg/gts-runtime",
  providerImportSource: "@gi-tcg/core/gts",
  shortcutFunctionPreludes: [
    "cryo",
    "hydro",
    "pyro",
    "electro",
    "anemo",
    "geo",
    "dendro",
    "omni",
  ],
  queryBindings: ["my", "opp"],
};

function* resolveGtsConfigImpl(
  filePath: string,
  inlineConfig: GtsConfig = {},
  options: ResolveGtsConfigAsyncOptions | ResolveGtsConfigSyncOptions,
): Generator<string | Promise<string>, Required<GtsConfig>, string> {
  const startDir = normalizeStartDir(filePath, options.cwd);
  const stopDir = options.stopDir ? path.resolve(options.stopDir) : void 0;
  const pkgConfig = yield* findNearestPackageConfig(
    options.readFileFn,
    startDir,
    stopDir,
  );
  return {
    ...DEFAULT_GTS_CONFIG,
    ...pkgConfig,
    ...inlineConfig,
  };
}

export async function resolveGtsConfig(
  filePath: string,
  inlineConfig: GtsConfig,
  options: ResolveGtsConfigAsyncOptions,
): Promise<Required<GtsConfig>> {
  const generator = resolveGtsConfigImpl(filePath, inlineConfig, options);
  let result = generator.next();
  while (!result.done) {
    const toRead = result.value;
    const content = await toRead;
    result = generator.next(content);
  }
  return result.value;
}

export function resolveGtsConfigSync(
  filePath: string,
  inlineConfig: GtsConfig,
  options: ResolveGtsConfigSyncOptions,
): Required<GtsConfig> {
  const generator = resolveGtsConfigImpl(filePath, inlineConfig, options);
  let result = generator.next();
  while (!result.done) {
    const toRead = result.value;
    if (toRead instanceof Promise) {
      throw new Error(
        "resolveGtsConfigSync received a Promise. Did you mean to use resolveGtsConfig instead?",
      );
    }
    const content = toRead;
    result = generator.next(content);
  }
  return result.value;
}

function normalizeStartDir(sourceFile: string, cwd?: string): string {
  const absolute = path.isAbsolute(sourceFile)
    ? sourceFile
    : path.resolve(cwd || ".", sourceFile);
  return path.dirname(absolute);
}

function* findNearestPackageConfig(
  readFileFn: ReadFileFn | ReadFileAsyncFn,
  startDir: string,
  stopDir?: string,
): Generator<string | Promise<string>, GtsConfig, string> {
  let currentDir = startDir;
  while (true) {
    const pkgPath = path.resolve(currentDir, "package.json");
    const config = yield* readPackageConfig(readFileFn, pkgPath);
    if (config) {
      return config;
    }
    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      break;
    }
    if (stopDir && currentDir === stopDir) {
      break;
    }
    currentDir = parentDir;
  }
  return {};
}

function* readPackageConfig(
  readFileFn: ReadFileFn | ReadFileAsyncFn,
  pkgPath: string,
): Generator<string | Promise<string>, GtsConfig | undefined, string> {
  try {
    const content = yield readFileFn(pkgPath, "utf8");
    const parsed = JSON.parse(content) as PackageJson;
    return parsed.gamingTs;
  } catch {
    return;
  }
}
