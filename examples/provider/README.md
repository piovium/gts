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

### Test Command

```bash
npm test
```

Runs validation tests on the generated DTS files to ensure:
- All files are generated successfully
- No external import statements remain (fully bundled)
- Expected exports are present
- Files have proper documentation headers

### How It Works

The build script (`scripts/build-dts.mjs`):
1. Reads the source TypeScript files
2. Inlines types from external dependencies (`@gi-tcg/gts-runtime`, etc.)
3. Removes import statements to create self-contained declaration files
4. Handles arktype's `type()` function by replacing it with type casts
5. Preserves all type information and exports

The bundling process ensures that each DTS file is completely standalone and can be used in isolated environments without requiring module resolution.

## Usage in Monaco Editor

The generated DTS files in `dist/` can be loaded into Monaco Editor to provide type definitions and IntelliSense for your custom language.

### Basic Setup

```typescript
import * as monaco from 'monaco-editor';

// Import the bundled DTS files as raw text
import vmDts from "@example/provider/dist/vm?raw";
import queryDts from "@example/provider/dist/query?raw";
import runtimeDts from "@example/provider/dist/runtime?raw";

// Add extra libraries to Monaco's TypeScript defaults
monaco.languages.typescript.typescriptDefaults.addExtraLib(
  runtimeDts,
  'file:///node_modules/@types/gts-runtime/index.d.ts'
);

monaco.languages.typescript.typescriptDefaults.addExtraLib(
  queryDts,
  'file:///node_modules/@types/gts-query/index.d.ts'
);

monaco.languages.typescript.typescriptDefaults.addExtraLib(
  vmDts,
  'file:///node_modules/@types/gts-vm/index.d.ts'
);
```

### With Vite

If you're using Vite, you can import the files using the `?raw` suffix:

```typescript
import vmDts from "@example/provider/dist/vm?raw";
```

This loads the file content as a string without processing it.

### Full Example

```typescript
import * as monaco from 'monaco-editor';
import vmDts from "@example/provider/dist/vm?raw";
import queryDts from "@example/provider/dist/query?raw";
import runtimeDts from "@example/provider/dist/runtime?raw";

// Configure Monaco
monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
  target: monaco.languages.typescript.ScriptTarget.ESNext,
  allowNonTsExtensions: true,
  moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
  module: monaco.languages.typescript.ModuleKind.ESNext,
});

// Add type definitions
monaco.languages.typescript.typescriptDefaults.addExtraLib(runtimeDts, 'gts-runtime.d.ts');
monaco.languages.typescript.typescriptDefaults.addExtraLib(queryDts, 'gts-query.d.ts');
monaco.languages.typescript.typescriptDefaults.addExtraLib(vmDts, 'gts-vm.d.ts');

// Create editor
const editor = monaco.editor.create(document.getElementById('container'), {
  value: '// Your GTS code here',
  language: 'typescript',
  theme: 'vs-dark',
});
```

## Technical Details

### Why Bundled DTS Files?

Monaco Editor runs in the browser and doesn't have access to node_modules or the ability to resolve external module imports. By bundling all type definitions into standalone files, we ensure that:

1. **No External Dependencies**: All type information is self-contained
2. **No Module Resolution**: Monaco doesn't need to resolve imports like `@gi-tcg/gts-runtime`
3. **Complete Type Information**: Users get full IntelliSense and type checking
4. **Easy Integration**: Just load the DTS files and they work immediately

### File Sizes

The bundled files are larger than the originals because they include all transitive dependencies:
- `query.d.ts`: ~440 bytes (minimal types)
- `runtime.d.ts`: ~11 KB (full runtime types from @gi-tcg/gts-runtime)
- `vm.d.ts`: ~17 KB (includes runtime + query + vm types)

This is acceptable for browser usage and enables full type checking in Monaco Editor.

## Development

To rebuild the DTS files after making changes to the source files:

```bash
npm run build
```

To verify the generated files:

```bash
npm test
```

The `dist/` directory is gitignored as these are build artifacts that should be regenerated as needed.
