import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import * as ts from "typescript";
import { afterEach, expect, test } from "vitest";

const require = createRequire(import.meta.url);
const externalFiles = require("../src/external_files.ts") as {
  findImportedGtsFiles(
    typescript: typeof ts,
    project: import("typescript/lib/tsserverlibrary").server.Project,
    options?: { openFilesOnly?: boolean },
  ): string[];
};

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("adds directly and transitively imported .gts files as external files", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "gts-plugin-test-"));
  temporaryDirectories.push(root);
  const sourceDirectory = path.join(root, "src");
  const packageDirectory = path.join(root, "node_modules", "gts-fixture");
  fs.mkdirSync(path.join(packageDirectory, "src"), { recursive: true });
  fs.mkdirSync(sourceDirectory, { recursive: true });

  fs.writeFileSync(
    path.join(root, "tsconfig.json"),
    JSON.stringify({ include: ["src/**/*.ts"] }),
  );
  fs.writeFileSync(
    path.join(sourceDirectory, "consumer.ts"),
    [
      'import { Card } from "./card.gts";',
      'import { PackageCard } from "gts-fixture/item.gts";',
      "void Card;",
      "void PackageCard;",
    ].join("\n"),
  );
  fs.writeFileSync(
    path.join(sourceDirectory, "card.gts"),
    'import "./nested.gts";\ndefine card { id 1 as Card; };',
  );
  fs.writeFileSync(
    path.join(sourceDirectory, "nested.gts"),
    "define card { id 2 as NestedCard; };",
  );
  fs.writeFileSync(
    path.join(packageDirectory, "package.json"),
    JSON.stringify({
      name: "gts-fixture",
      exports: { "./*": "./src/*" },
    }),
  );
  fs.writeFileSync(
    path.join(packageDirectory, "src", "item.gts"),
    "define card { id 3 as PackageCard; };",
  );

  const project = {
    projectKind: ts.server.ProjectKind.Configured,
    getProjectName: () => path.join(root, "tsconfig.json"),
    getCurrentDirectory: () => root,
    getCompilerOptions: () => ({
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
    }),
    getFileNames: () => [],
    useCaseSensitiveFileNames: () => ts.sys.useCaseSensitiveFileNames,
    fileExists: ts.sys.fileExists,
    readFile: ts.sys.readFile,
    readDirectory: ts.sys.readDirectory,
    projectService: {
      openFiles: new Map(),
      getScriptInfoForPath: () => undefined,
    },
  };
  const importedFiles = externalFiles.findImportedGtsFiles(
    ts,
    project as any,
  );

  expect(new Set(importedFiles)).toEqual(
    new Set([
      fs.realpathSync(path.join(sourceDirectory, "card.gts")),
      fs.realpathSync(path.join(sourceDirectory, "nested.gts")),
      fs.realpathSync(path.join(packageDirectory, "src", "item.gts")),
    ]),
  );
});

test("only follows open-file imports in native bridge mode", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "gts-plugin-test-"));
  temporaryDirectories.push(root);
  const openFile = path.join(root, "open.ts");
  const closedFile = path.join(root, "closed.ts");
  const openGts = path.join(root, "open.gts");
  const closedGts = path.join(root, "closed.gts");
  fs.writeFileSync(openFile, 'import "./open.gts";');
  fs.writeFileSync(closedFile, 'import "./closed.gts";');
  fs.writeFileSync(openGts, "define card { id 1 as OpenCard; };");
  fs.writeFileSync(closedGts, "define card { id 2 as ClosedCard; };");

  const openScriptInfo = {
    fileName: openFile,
    containingProjects: [] as unknown[],
  };
  const unrelatedScriptInfo = {
    fileName: closedFile,
    containingProjects: [],
  };
  const project = {
    projectKind: ts.server.ProjectKind.Configured,
    getProjectName: () => path.join(root, "tsconfig.json"),
    getCompilerOptions: () => ({
      moduleResolution: ts.ModuleResolutionKind.Bundler,
    }),
    getFileNames: () => [openFile, closedFile],
    isRoot: () => false,
    projectService: {
      openFiles: new Map([
        ["/open.ts", undefined],
        ["/unrelated.ts", undefined],
      ]),
      getScriptInfoForPath: (fileName: string) =>
        fileName === "/open.ts" ? openScriptInfo : unrelatedScriptInfo,
      getConfigFileNameForFile: (scriptInfo: typeof openScriptInfo) =>
        scriptInfo === openScriptInfo
          ? path.join(root, "tsconfig.json")
          : path.join(root, "other", "tsconfig.json"),
    },
    readFile: ts.sys.readFile,
    fileExists: ts.sys.fileExists,
  };
  const importedFiles = externalFiles.findImportedGtsFiles(
    ts,
    project as any,
    { openFilesOnly: true },
  );

  expect(importedFiles).toEqual([fs.realpathSync(openGts)]);
});
