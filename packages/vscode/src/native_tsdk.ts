import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

/** Resolve without loading TypeScript into the extension host. */
export function resolveNativeTsdk(
  workspaceDirectories: readonly string[],
  configuredTsdk?: string,
): string {
  const candidates: string[] = [];
  if (configuredTsdk) {
    if (path.isAbsolute(configuredTsdk)) {
      candidates.push(configuredTsdk);
    } else {
      for (const directory of workspaceDirectories) {
        candidates.push(path.resolve(directory, configuredTsdk));
      }
    }
  }
  for (const directory of workspaceDirectories) {
    try {
      const workspaceRequire = createRequire(
        path.join(directory, "package.json"),
      );
      candidates.push(
        path.dirname(workspaceRequire.resolve("typescript/lib/typescript.js")),
      );
    } catch {
      // A workspace may not have installed its dependencies yet.
    }
  }
  candidates.push(
    path.dirname(require.resolve("typescript/lib/typescript.js")),
  );
  for (const candidate of candidates) {
    try {
      const manifest = JSON.parse(
        readFileSync(path.join(candidate, "../package.json"), "utf8"),
      );
      if (manifest.name === "typescript-native-bridge") {
        return candidate;
      }
    } catch {
      // Try the next SDK if this package cannot be read.
    }
  }
  throw new Error(
    "GamingTS requires a typescript-native-bridge SDK. Reinstall the extension or the workspace dependencies.",
  );
}
