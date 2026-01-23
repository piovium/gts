import path from "node:path";
import type { TranspileOption } from "./transform/gts";

export interface GtsConfig extends TranspileOption {}

export interface PackageJson {
  gamingTs?: GtsConfig;
}

type ReadFileFn = (path: string, encoding: "utf-8") => string;
type ReadFileFnAsync = (
  path: string,
  encoding: "utf-8",
) => string | Promise<string>;

export interface ResolveGtsConfigOptions {
  readFileFn: ReadFileFn;
  cwd?: string;
  stopDir?: string;
}

export interface ResolveGtsConfigOptionsAsync {
  readFileFn: ReadFileFnAsync;
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

export async function resolveGtsConfigAsync(
  filePath: string,
  inlineOption: GtsConfig = {},
  options: ResolveGtsConfigOptionsAsync,
): Promise<Required<GtsConfig>> {
  const startDir = normalizeStartDir(filePath, options.cwd);
  const stopDir = options.stopDir ? path.resolve(options.stopDir) : undefined;
  const pkgConfig = await findNearestPackageConfigAsync(
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

function* iteratePackageJsonPaths(startDir: string, stopDir?: string) {
  let currentDir = startDir;
  const stopAt = stopDir ? path.resolve(stopDir) : undefined;
  while (true) {
    yield path.join(currentDir, "package.json");
    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      break;
    }
    if (stopAt && currentDir === stopAt) {
      break;
    }
    currentDir = parentDir;
  }
}

function findNearestPackageConfig(
  readFileFn: ReadFileFn,
  startDir: string,
  stopDir?: string,
): GtsConfig {
  for (const pkgPath of iteratePackageJsonPaths(startDir, stopDir)) {
    try {
      const content = readFileFn(pkgPath, "utf-8");
      const config = parsePackageConfig(content);
      if (config) {
        return config;
      }
    } catch {
      // ignore
    }
  }
  return {};
}

async function findNearestPackageConfigAsync(
  readFileFn: ReadFileFnAsync,
  startDir: string,
  stopDir?: string,
): Promise<GtsConfig> {
  for (const pkgPath of iteratePackageJsonPaths(startDir, stopDir)) {
    try {
      const content = await readFileFn(pkgPath, "utf-8");
      const config = parsePackageConfig(content);
      if (config) {
        return config;
      }
    } catch {
      // ignore
    }
  }
  return {};
}

function parsePackageConfig(content: string): GtsConfig | undefined {
  try {
    const parsed = JSON.parse(content) as PackageJson;
    return parsed.gamingTs;
  } catch {
    return undefined;
  }
}
