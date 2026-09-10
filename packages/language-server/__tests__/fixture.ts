import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
export const repository = fileURLToPath(new URL("../../../", import.meta.url));
export const tsdk = path.dirname(
  require.resolve("typescript/lib/typescript.js"),
);
export const typescriptPackageJson = require.resolve("typescript/package.json");
export const character = [
  "// 芭芭拉：跨文件类型与位置映射",
  "define character {",
  "  id 1201 as Barbara;",
  '  since "v3.3.0";',
  "  tags hydro, catalyst, mondstadt;",
  "  health 10;",
  "  energy 3;",
  "};",
  "export const shared: number = 1201;",
  "",
].join("\r\n");

export const fixtureSources = {
  "current.gts": character,
  "old_versions.gts":
    'import { Barbara } from "./current.gts";\r\nexport const legacy: number = Barbara;\r\n',
  "consumer.ts":
    'import { Barbara, shared } from "./current.gts";\r\nimport { legacy } from "./old_versions.gts";\r\nexport const value: number = Barbara + legacy;\r\nexport const sharedValue: number = shared;\r\nMath.max(1, 2);\r\n',
  "component.tsx":
    'import { shared } from "./current.gts";\r\ndeclare global {\r\n  namespace JSX {\r\n    interface IntrinsicElements { character: { id: number }; }\r\n  }\r\n}\r\nexport const node = <character id={shared} />;\r\nMath.max(1, 2);\r\n',
  "isolated.gts": character.replaceAll("Barbara", "Unreferenced"),
} as const;

export function createFixture() {
  // The fixture lives inside the repository so that the GTS and TypeScript
  // packages resolve from the workspace installation. Its name carries a
  // non-ASCII prefix and a space, so it also covers such working directories.
  const directory = mkdtempSync(
    path.join(repository, "packages/language-server/__tests__/临时 fixture-"),
  );
  const relative = (target: string) =>
    path
      .relative(directory, path.join(repository, target))
      .replaceAll(path.sep, "/");
  const write = (name: string, text: string) =>
    writeFileSync(path.join(directory, name), text);
  write(
    "package.json",
    JSON.stringify({
      type: "module",
      gamingTs: {
        providerImportSource: relative("examples/provider"),
        runtimeImportSource: relative("packages/runtime/dist/index.js"),
      },
    }),
  );
  write(
    "tsconfig.json",
    JSON.stringify({
      compilerOptions: {
        strict: true,
        noEmit: true,
        target: "ESNext",
        module: "Preserve",
        moduleResolution: "Bundler",
        jsx: "Preserve",
        types: ["node"],
        allowImportingTsExtensions: true,
      },
      include: ["./*.ts", "./*.tsx", "./*.gts"],
    }),
  );
  for (const [name, text] of Object.entries(fixtureSources)) write(name, text);
  return {
    directory,
    write,
    uri: (name = "") => pathToFileURL(path.join(directory, name)).toString(),
    dispose: () => rmSync(directory, { recursive: true, force: true }),
  };
}
