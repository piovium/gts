import { existsSync } from "node:fs";
import path from "node:path";
import type { Disposable } from "vscode";

/**
 * Take over the tsserver process of the built-in TypeScript extension in this
 * window, so that it runs on the SDK shared with the GTS language server.
 *
 * The redirect is deliberately window-wide: every `tsserver.js` launched while
 * the patch is installed is replaced, including one started from a
 * user-configured `typescript.tsdk`. GTS needs both language services to agree
 * on program semantics, so a stock tsserver is never acceptable here.
 *
 * VS Code offers no hook for replacing that process, and rewriting the user's
 * `typescript.tsdk` setting is not something a language extension does on its
 * own, so the `spawn` and `fork` entry points are wrapped instead.
 */
export function redirectTsserver(tsdk: string): Disposable {
  // The live CommonJS module object is patched, not an ESM namespace import:
  // a bundler-created namespace is read-only, so its `spawn` cannot be replaced.
  const childProcess =
    require("node:child_process") as typeof import("node:child_process");
  const originalSpawn = childProcess.spawn;
  const originalFork = childProcess.fork;
  const nativeServerPath = path.join(tsdk, "tsserver.js");
  if (!existsSync(nativeServerPath)) {
    throw new Error(
      `GamingTS cannot redirect tsserver: ${nativeServerPath} does not exist. Reinstall the workspace dependencies or the extension.`,
    );
  }
  const isTsserverPath = (file: unknown): file is string =>
    typeof file === "string" &&
    path.isAbsolute(file) &&
    path.basename(file) === "tsserver.js";
  const redirect = (file: string): string => {
    if (file === nativeServerPath) {
      return file;
    }
    console.log(
      `[GamingTS] Redirecting tsserver to the native SDK: ${file} -> ${nativeServerPath}`,
    );
    return nativeServerPath;
  };
  const redirectAll = (args: unknown[]): unknown[] =>
    args.map((arg) => (isTsserverPath(arg) ? redirect(arg) : arg));
  const patchedSpawn = new Proxy(originalSpawn, {
    apply(target, receiver, args) {
      if (Array.isArray(args[1])) args[1] = redirectAll(args[1]);
      return Reflect.apply(target, receiver, args);
    },
  });
  const patchedFork = new Proxy(originalFork, {
    apply(target, receiver, args) {
      if (isTsserverPath(args[0])) {
        args[0] = redirect(args[0]);
      }
      return Reflect.apply(target, receiver, args);
    },
  });
  childProcess.spawn = patchedSpawn;
  childProcess.fork = patchedFork;
  return {
    dispose() {
      if (childProcess.spawn === patchedSpawn) {
        childProcess.spawn = originalSpawn;
      }
      if (childProcess.fork === patchedFork) {
        childProcess.fork = originalFork;
      }
    },
  };
}
