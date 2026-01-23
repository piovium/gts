import path from "node:path";
import type { TranspileOption } from "./transform/gts";

export interface GtsConfig extends TranspileOption {}

export interface PackageJson {
  gamingTs?: GtsConfig;
}

type ReadFileFn = (path: string, encoding: "utf-8") => string;

export interface ResolveGtsConfigOptions {
  readFileFn: ReadFileFn;
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

export function resolveGtsConfig(
  filePath: string,
  inlineOption: GtsConfig = {},
  options: ResolveGtsConfigOptions,
): Required<GtsConfig> {
  const startDir = normalizeStartDir(filePath, options.cwd);
  const stopDir = options.stopDir ? path.resolve(options.stopDir) : undefined;
  const pkgConfig = findNearestPackageConfig(
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
