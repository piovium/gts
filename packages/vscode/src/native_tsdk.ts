import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

/** Resolve without loading TypeScript into the extension host. */
export function resolveNativeTsdk(
  workspaceDirectories: readonly string[],
  configuredTsdk?: string,
): string {
  const native = sdkCandidates(workspaceDirectories, configuredTsdk).find(
    isNativeSdk,
  );
  if (!native) {
    throw new Error(
      "GamingTS requires a typescript-native-bridge SDK. Reinstall the extension or the workspace dependencies.",
    );
  }
  return native;
}

/**
 * SDK directories to try, in order: one the user configured explicitly, the SDK
 * each workspace folder installed, and finally the one this extension ships.
 */
function sdkCandidates(
  workspaceDirectories: readonly string[],
  configuredTsdk?: string,
): string[] {
  const candidates: string[] = [];
  const configured = configuredTsdk;
  if (configured) {
    candidates.push(
      ...(path.isAbsolute(configured)
        ? [configured]
        : workspaceDirectories.map((directory) =>
            path.resolve(directory, configured),
          )),
    );
  }
  for (const directory of workspaceDirectories) {
    const installed = installedSdk(directory);
    if (installed) candidates.push(installed);
  }
  candidates.push(sdkOf(require));
  return candidates;
}

/** The SDK a workspace folder installed, or `undefined` before it installs one. */
function installedSdk(directory: string): string | undefined {
  try {
    return sdkOf(createRequire(path.join(directory, "package.json")));
  } catch {
    return undefined;
  }
}

/** The SDK a module resolution context loads for `typescript`. */
function sdkOf(context: ReturnType<typeof createRequire>): string {
  return path.dirname(context.resolve("typescript/lib/typescript.js"));
}

/** Only the native bridge may serve the GTS language services. */
function isNativeSdk(directory: string): boolean {
  try {
    const manifest = JSON.parse(
      readFileSync(path.join(directory, "..", "package.json"), "utf8"),
    ) as { name?: string };
    return manifest.name === "typescript-native-bridge";
  } catch {
    return false;
  }
}
