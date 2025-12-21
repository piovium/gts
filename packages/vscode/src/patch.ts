import * as vscode from "vscode";
import type { ObjectEncodingOptions, PathOrFileDescriptor } from "node:fs";

export async function patchTypeScriptExtension() {
  console.log("[GamingTS] Starting TypeScript extension patch...");

  const tsExtension = vscode.extensions.getExtension(
    "vscode.typescript-language-features"
  );
  if (!tsExtension) {
    console.warn("[GamingTS] TypeScript extension not found");
    return { success: false, reason: "missing" } as const;
  }

  if (tsExtension.isActive) {
    return { success: false, reason: "alreadyActive" } as const;
  }

  const fs = require("node:fs");
  const originalReadFileSync = fs.readFileSync;
  const extensionJsPath = require.resolve("./dist/extension.js", {
    paths: [tsExtension.extensionPath],
  });

  function patchedReadFileSync(
    path: PathOrFileDescriptor,
    options: (ObjectEncodingOptions & { flag?: string }) | BufferEncoding | null
  ) {
    const hasOptions = typeof options !== "undefined" && options !== null;
    const result: string | Buffer = hasOptions
      ? originalReadFileSync.call(fs, path, options)
      : originalReadFileSync.call(fs, path);
    if (path === extensionJsPath) {
      console.log(
        "[GamingTS] Intercepted read of TypeScript extension.js, applying patch..."
      );
      const text =
        typeof result === "string" ? result : result.toString("utf8");

      // Patch the TypeScript extension to recognize GamingTS files
      let patched = text
        .replace(
          "t.jsTsLanguageModes=[t.javascript,t.javascriptreact,t.typescript,t.typescriptreact]",
          (s) => s + '.concat("gaming-ts")'
        )
        .replace(
          ".languages.match([t.typescript,t.typescriptreact,t.javascript,t.javascriptreact]",
          (s) => s + '.concat("gaming-ts")'
        )
        .replace(
          ".languages.match([t.typescript,t.typescriptreact]",
          (s) => s + '.concat("gaming-ts")'
        );

      if (patched !== text) {
        console.log("[GamingTS] Successfully patched TypeScript extension");
        return typeof result === "string"
          ? patched
          : Buffer.from(patched, "utf8");
      } else {
        console.warn(
          "[GamingTS] TypeScript extension patterns did not match - may already be patched or structure changed"
        );
      }
    }
    return result;
  }

  try {
    console.log(
      "[GamingTS] Installing fs.readFileSync hook and activating TypeScript extension..."
    );
    fs.readFileSync = /** @type {any} */ patchedReadFileSync;
    await tsExtension.activate();
    console.log("[GamingTS] TypeScript extension activated");
  } catch (error) {
    console.error("[GamingTS] Failed to activate TypeScript extension:", error);
  } finally {
    fs.readFileSync = originalReadFileSync;
    console.log("[GamingTS] fs.readFileSync hook removed");
  }

  return { success: true, reason: "patched" } as const;
}
