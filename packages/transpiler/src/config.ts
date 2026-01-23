import path from "node:path";
import type { TranspileOption } from "./transform/gts";

export interface GtsConfig extends TranspileOption {}

export interface PackageJson {
  gamingTs?: GtsConfig;
}

type ReadFileFn = (path: string, encoding: "utf-8") => string;
type ReadFileAsyncFn = (path: string, encoding: "utf-8") => Promise<string>;

export interface ResolveGtsConfigSyncOptions {
  readFileFn: ReadFileFn;
  cwd?: string;
  stopDir?: string;
}

export type ResolveGtsConfigOptions =
  | ResolveGtsConfigSyncOptions
  | ResolveGtsConfigAsyncOptions;

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

export function resolveGtsConfigSync(
  filePath: string,
  inlineOption: GtsConfig = {},
  options: ResolveGtsConfigSyncOptions,
): Required<GtsConfig> {
  return resolveGtsConfigSyncWith(
    filePath,
    inlineOption,
    options,
    findNearestPackageConfig,
  );
}

export async function resolveGtsConfig(
  filePath: string,
  inlineOption: GtsConfig = {},
  options: ResolveGtsConfigAsyncOptions,
): Promise<Required<GtsConfig>> {
  return resolveGtsConfigAsyncWith(
    filePath,
    inlineOption,
    options,
    findNearestPackageConfigAsync,
  );
}

function resolveGtsConfigSyncWith(
  filePath: string,
  inlineOption: GtsConfig,
  options: ResolveGtsConfigSyncOptions,
  resolvePackageConfig: (
    readFileFn: ReadFileFn,
    startDir: string,
    stopDir?: string,
  ) => GtsConfig,
): Required<GtsConfig> {
  const startDir = normalizeStartDir(filePath, options.cwd);
  const stopDir = options.stopDir ? path.resolve(options.stopDir) : undefined;
  const pkgConfig = resolvePackageConfig(
    options.readFileFn,
    startDir,
    stopDir,
  );
  return {
    ...DEFAULT_GTS_CONFIG,
    ...pkgConfig,
    ...inlineOption,
  };
}

async function resolveGtsConfigAsyncWith(
  filePath: string,
  inlineOption: GtsConfig,
  options: ResolveGtsConfigAsyncOptions,
  resolvePackageConfig: (
    readFileFn: ReadFileAsyncFn,
    startDir: string,
    stopDir?: string,
  ) => Promise<GtsConfig>,
): Promise<Required<GtsConfig>> {
  const startDir = normalizeStartDir(filePath, options.cwd);
  const stopDir = options.stopDir ? path.resolve(options.stopDir) : undefined;
  const pkgConfig = await resolvePackageConfig(
    options.readFileFn,
    startDir,
    stopDir,
  );
  return {
    ...DEFAULT_GTS_CONFIG,
    ...pkgConfig,
    ...inlineOption,
  };
}

function normalizeStartDir(sourceFile: string, cwd?: string): string {
  const absolute = path.isAbsolute(sourceFile)
    ? sourceFile
    : path.resolve(cwd || ".", sourceFile);
  return path.dirname(absolute);
}

function findNearestPackageConfig(
  readFileFn: ReadFileFn,
  startDir: string,
  stopDir?: string,
): GtsConfig {
  let currentDir = startDir;
  const stopAt = stopDir ? path.resolve(stopDir) : undefined;
  while (true) {
    const pkgPath = path.join(currentDir, "package.json");
    const config = readPackageConfig(readFileFn, pkgPath);
    if (config) {
      return config;
    }
    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      break;
    }
    if (stopAt && currentDir === stopAt) {
      break;
    }
    currentDir = parentDir;
  }
  return {};
}

async function findNearestPackageConfigAsync(
  readFileFn: ReadFileAsyncFn,
  startDir: string,
  stopDir?: string,
): Promise<GtsConfig> {
  let currentDir = startDir;
  const stopAt = stopDir ? path.resolve(stopDir) : undefined;
  while (true) {
    const pkgPath = path.join(currentDir, "package.json");
    const config = await readPackageConfigAsync(readFileFn, pkgPath);
    if (config) {
      return config;
    }
    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      break;
    }
    if (stopAt && currentDir === stopAt) {
      break;
    }
    currentDir = parentDir;
  }
  return {};
}

function readPackageConfig(
  readFileFn: ReadFileFn,
  pkgPath: string,
): GtsConfig | undefined {
  try {
    const content = readFileFn(pkgPath, "utf-8");
    const parsed = JSON.parse(content) as PackageJson;
    return parsed.gamingTs;
  } catch {
    return undefined;
  }
}

async function readPackageConfigAsync(
  readFileFn: ReadFileAsyncFn,
  pkgPath: string,
): Promise<GtsConfig | undefined> {
  try {
    const content = await readFileFn(pkgPath, "utf-8");
    const parsed = JSON.parse(content) as PackageJson;
    return parsed.gamingTs;
  } catch {
    return undefined;
  }
}
