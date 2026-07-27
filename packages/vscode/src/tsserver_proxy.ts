import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const proxyPaths = new Map<string, string>();

export function isTsserverFile(file: string): boolean {
  return path.isAbsolute(file) && path.basename(file) === "tsserver.js";
}

export function transformTsserver(serverPath: string): string {
  const cached = proxyPaths.get(serverPath);
  if (cached) {
    return cached;
  }

  try {
    const resolvedServerPath = require.resolve(serverPath, {
      paths: [path.dirname(serverPath)],
    });
    const typescriptPath = path.join(
      path.dirname(resolvedServerPath),
      "typescript.js",
    );
    const text = createTsserverProxyText(
      resolvedServerPath,
      typescriptPath,
    );
    const hash = createHash("sha256").update(text).digest("hex").slice(0, 16);
    const proxyDirectory = path.join(
      os.tmpdir(),
      `gamingts-vscode-${process.getuid?.() ?? "user"}`,
      hash,
    );
    const proxyPath = path.join(proxyDirectory, "tsserver.js");

    fs.mkdirSync(proxyDirectory, { recursive: true, mode: 0o700 });
    if (
      !fs.existsSync(proxyPath)
      || fs.readFileSync(proxyPath, "utf8") !== text
    ) {
      fs.writeFileSync(proxyPath, text, { mode: 0o600 });
    }
    proxyPaths.set(serverPath, proxyPath);
    return proxyPath;
  } catch (error) {
    console.error(
      `[GamingTS] Failed to create a TypeScript server proxy for ${serverPath}`,
      error,
    );
    return serverPath;
  }
}

export function createTsserverProxyText(
  resolvedServerPath: string,
  typescriptPath: string,
): string {
  return `
const fs = require("node:fs");
const readFileSync = fs.readFileSync;
const patchTypeScriptSource = ${patchTypeScriptSource.toString()};

fs.readFileSync = (...args) => {
  const content = readFileSync(...args);
  if (args[0] !== ${JSON.stringify(typescriptPath)} || typeof content !== "string") {
    return content;
  }
  try {
    return patchTypeScriptSource(content);
  } catch (error) {
    process.stderr.write(\`[GamingTS] Failed to patch workspace TypeScript: \${error}\\n\`);
    return content;
  }
};

module.exports = require(${JSON.stringify(resolvedServerPath)});
`;
}

export function patchTypeScriptSource(source: string): string {
  function replaceRequired(
    text: string,
    pattern: RegExp,
    replacement: string | ((substring: string, ...args: any[]) => string),
    label: string,
  ): string {
    const replaced = text.replace(pattern, replacement as any);
    if (replaced === text) {
      throw new Error(`Unsupported TypeScript build: ${label} was not found`);
    }
    return replaced;
  }

  // TypeScript Native Bridge consumes GTS files through the language service
  // plugin's external-files contract. Keep an opened GTS document out of its
  // nearest configured project: otherwise tsgo follows that project's entry
  // points and eagerly materializes every GTS overlay before answering the
  // first editor request. Imported GTS files still belong to their configured
  // project and are discovered by the plugin.
  if (source.includes("function createTsgoProgram(")) {
    return replaceRequired(
      source,
      /getConfigFileNameForFile\(info, findFromCacheOnly\) \{/,
      (match) => `${match}
    if (info.fileName.toLowerCase().endsWith(".gts")) return void 0;`,
      "ProjectService.getConfigFileNameForFile",
    );
  }

  let result = replaceRequired(
    source,
    /supportedTSExtensions = .*(?=;)/,
    (match) => `${match}.concat([".gts"])`,
    "supportedTSExtensions",
  );
  result = replaceRequired(
    result,
    /supportedJSExtensions = .*(?=;)/,
    (match) => `${match}.concat([".gts"])`,
    "supportedJSExtensions",
  );
  result = replaceRequired(
    result,
    /allSupportedExtensions = .*(?=;)/,
    (match) => `${match}.concat([".gts"])`,
    "allSupportedExtensions",
  );
  result = replaceRequired(
    result,
    /function changeExtension\(/,
    (match) => `function changeExtension(path, newExtension) {
  return [".gts"].some(ext => path.endsWith(ext))
    ? path + newExtension
    : _changeExtension(path, newExtension);
}
${match.replace("changeExtension", "_changeExtension")}`,
    "changeExtension",
  );

  return result.replace(
    /const isJs = hasJSFileExtension\((.*?)\.fileName\)/,
    (_match, file) => `const isJs = isSourceFileJS(${file})`,
  );
}
