import path from "node:path";
import type { TranspileOption } from "./transform/gts";

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
    const pkgPath = path.join(currentDir, "package.json");
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
