import type ts from "typescript";

/** Load the library graph belonging to the SDK that the worker actually uses. */
export async function loadTypeScriptLibs(
  typescript: typeof ts,
  tsdkUrl: string,
  writeFile: (name: string, content: string) => void,
): Promise<void> {
  // TypeScript exposes its library registry at runtime, but omits it from typescript.d.ts.
  const libMap = (typescript as typeof ts & { libMap: ReadonlyMap<string, string> }).libMap;
  if (!libMap?.values) throw new Error("The TypeScript SDK does not expose its library registry");
  const pending = new Set(["lib.d.ts", ...libMap.values()]);
  for (const target of Object.values(typescript.ScriptTarget)) {
    if (typeof target === "number") pending.add(typescript.getDefaultLibFileName({ target }));
  }
  const loaded = new Set<string>();
  while (pending.size) {
    const batch = [...pending].filter((name) => !loaded.has(name));
    pending.clear();
    const contents = await Promise.all(batch.map(async (name) => {
      const url = `${tsdkUrl.replace(/\/$/, "")}/${name}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Cannot load TypeScript library ${url}: HTTP ${response.status}`);
      return [name, await response.text()] as const;
    }));
    for (const [name, content] of contents) {
      loaded.add(name);
      writeFile(name, content);
      for (const reference of typescript.preProcessFile(content).libReferenceDirectives) {
        const referencedLib = libMap.get(reference.fileName.toLowerCase()) ?? `lib.${reference.fileName.toLowerCase()}.d.ts`;
        if (!loaded.has(referencedLib)) pending.add(referencedLib);
      }
    }
  }
}
