import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
export const repository = fileURLToPath(new URL("../../../", import.meta.url));
export const tsdk = path.dirname(require.resolve("typescript/lib/typescript.js"));
export const character = [
  "// 芭芭拉：跨文件类型与位置映射",
  "define character {",
  "  id 1201 as Barbara;",
  '  since "v3.3.0";',
  "  tags hydro, catalyst, mondstadt;",
  "  health 10;",
  "  energy 3;",
  "};",
  "",
].join("\r\n");

export function createFixture() {
  const directory = mkdtempSync(path.join(repository, "packages/language-server/__tests__/临时 fixture-"));
  const relative = (target: string) => path.relative(directory, path.join(repository, target)).replaceAll(path.sep, "/");
  const write = (name: string, text: string) => writeFileSync(path.join(directory, name), text);
  write("package.json", JSON.stringify({
    type: "module",
    gamingTs: {
      providerImportSource: relative("examples/provider"),
      runtimeImportSource: relative("packages/runtime/dist/index.js"),
    },
  }));
  write("tsconfig.json", JSON.stringify({
    compilerOptions: {
      strict: true,
      noEmit: true,
      target: "ESNext",
      module: "Preserve",
      moduleResolution: "Bundler",
      types: ["node"],
      allowImportingTsExtensions: true,
    },
    include: ["./*.ts", "./*.gts"],
  }));
  write("current.gts", character);
  write("old_versions.gts", 'import { Barbara } from "./current.gts";\r\nexport const legacy: number = Barbara;\r\n');
  write("consumer.ts", 'import { Barbara } from "./current.gts";\r\nimport { legacy } from "./old_versions.gts";\r\nexport const value: number = Barbara + legacy;\r\n');
  write("isolated.gts", character.replaceAll("Barbara", "Unreferenced"));
  return {
    directory,
    write,
    uri: (name = "") => pathToFileURL(path.join(directory, name)).toString(),
    dispose: () => rmSync(directory, { recursive: true, force: true }),
  };
}
