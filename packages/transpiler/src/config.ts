import type { TranspileOption } from "./transform/gts.ts";
import browserPath from "path-browserify-esm";

export interface GtsConfig extends TranspileOption {}

export interface PackageJson {
  gamingTs?: GtsConfig;
}

type ReadFileFn = (path: string, encoding: "utf8") => string;
type ReadFileAsyncFn = (path: string, encoding: "utf8") => Promise<string>;

export interface PathModule {
  resolve(...paths: string[]): string;
  dirname(path: string): string;
  isAbsolute(path: string): boolean;
}

interface ResolveGtsConfigBaseOptions {
  cwd?: string;
  pathModule?: PathModule;
  stopDir?: string;
}

export interface ResolveGtsConfigSyncOptions extends ResolveGtsConfigBaseOptions {
  readFileFn: ReadFileFn;
}

export interface ResolveGtsConfigAsyncOptions extends ResolveGtsConfigBaseOptions {
  readFileFn: ReadFileAsyncFn;
}

const DEFAULT_GTS_CONFIG: Required<GtsConfig> = {
  runtimeImportSource: "@gi-tcg/gts-runtime",
  providerImportSource: "@gi-tcg/core/gts",
};

function* resolveGtsConfigImpl(
  filePath: string,
  inlineConfig: GtsConfig = {},
  options: ResolveGtsConfigAsyncOptions | ResolveGtsConfigSyncOptions,
): Generator<string | Promise<string>, Required<GtsConfig>, string> {
  const pathModule = options.pathModule || browserPath;
  const startDir = normalizeStartDir(filePath, pathModule, options.cwd);
  const stopDir = options.stopDir
    ? pathModule.resolve(options.stopDir)
    : void 0;
  const pkgConfig = yield* findNearestPackageConfig(
    options.readFileFn,
    pathModule,
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
  options.pathModule ??= await import("node:path").then((mod) => mod.default);
  const generator = resolveGtsConfigImpl(filePath, inlineConfig, options);
  let result = generator.next();
  while (!result.done) {
    const toRead = result.value;
    // return an invalid JSON if readFile fails, so that the generator
    // can catch the error and try next one
    const content = await Promise.resolve(toRead).catch(() => "");
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

function normalizeStartDir(
  sourceFile: string,
  pathModule: PathModule,
  cwd?: string,
): string {
  const absolute = pathModule.isAbsolute(sourceFile)
    ? sourceFile
    : pathModule.resolve(cwd || ".", sourceFile);
  return pathModule.dirname(absolute);
}

function* findNearestPackageConfig(
  readFileFn: ReadFileFn | ReadFileAsyncFn,
  pathModule: PathModule,
  startDir: string,
  stopDir?: string,
): Generator<string | Promise<string>, GtsConfig, string> {
  let currentDir = startDir;
  while (true) {
    const pkgPath = pathModule.resolve(currentDir, "package.json");
    const config = yield* readPackageConfig(readFileFn, pkgPath);
    if (config) {
      return config;
    }
    const parentDir = pathModule.dirname(currentDir);
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
