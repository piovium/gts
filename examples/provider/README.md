# Provider Package

This package contains type definitions and runtime utilities for the GamingTS (GTS) language.

## Files

- `vm.ts` - View Model definitions for character, skill, and summon builders
- `query.ts` - Query builder interface and types
- `runtime.ts` - Re-exports all runtime utilities from `@gi-tcg/gts-runtime`

## Building Bundled DTS Files

The bundled `.d.ts` files are standalone TypeScript declaration files that include all external type dependencies. These are designed for use in Monaco Editor where external module resolution may not be available.

### Build Command

```bash
npm run build
```

This will generate three bundled declaration files in the `dist/` directory:
- `dist/vm.d.ts` - Standalone declarations for vm.ts (includes runtime and query types)
- `dist/query.d.ts` - Standalone declarations for query.ts
- `dist/runtime.d.ts` - Standalone declarations bundling @gi-tcg/gts-runtime

### How It Works

The build script (`scripts/build-dts.mjs`):
1. Reads the source TypeScript files
2. Inlines types from external dependencies (`@gi-tcg/gts-runtime`, etc.)
3. Removes import statements to create self-contained declaration files
4. Handles arktype's `type()` function by replacing it with type casts

### Usage in Monaco Editor

The generated DTS files in `dist/` can be loaded into Monaco Editor using `monaco.languages.typescript.typescriptDefaults.addExtraLib()`:

```typescript
import vmDts from "@example/provider/dist/vm?raw";
import queryDts from "@example/provider/dist/query?raw";
import runtimeDts from "@example/provider/dist/runtime?raw";

// Add to Monaco
monaco.languages.typescript.typescriptDefaults.addExtraLib(vmDts, "file:///node_modules/@types/vm/index.d.ts");
monaco.languages.typescript.typescriptDefaults.addExtraLib(queryDts, "file:///node_modules/@types/query/index.d.ts");
monaco.languages.typescript.typescriptDefaults.addExtraLib(runtimeDts, "file:///node_modules/@types/runtime/index.d.ts");
```

The bundled files have no external dependencies, making them suitable for isolated environments like web-based editors.
