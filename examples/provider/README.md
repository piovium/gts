# Provider Package

This package provides TypeScript type definitions for the GamingTS (GTS) language, specifically designed for use in Monaco Editor and other browser-based TypeScript environments.

## Overview

The provider package contains three main modules:

- **vm.ts** - View Model definitions for game entities (characters, skills, summons)
- **query.ts** - Query builder for entity selection
- **runtime.ts** - Core runtime types and utilities (re-exports from `@gi-tcg/gts-runtime`)

## Building DTS Bundles

The package includes a build script that generates standalone TypeScript declaration files (`.d.ts`) for each module. These bundled declaration files:

- Include all type definitions inline (no external imports)
- Are suitable for use in Monaco Editor's TypeScript language service
- Can be loaded independently without requiring module resolution

### Build Command

```bash
npm run build
# or
bun run build
```

This will generate three files in the `dist/` directory:

- `dist/runtime.d.ts` - Runtime types bundled
- `dist/query.d.ts` - Query builder types bundled  
- `dist/vm.d.ts` - View Model types bundled

### Testing

To validate the generated DTS files:

```bash
npm test
# or
bun test
```

The test script verifies that:
1. All three DTS files are generated
2. No files contain imports (they're standalone)
3. All expected exports are present

## Usage in Monaco Editor

The generated DTS files can be loaded in Monaco Editor using the `addExtraLib` API:

```typescript
import runtimeDts from '@example/provider/dist/runtime.d.ts?raw';
import queryDts from '@example/provider/dist/query.d.ts?raw';
import vmDts from '@example/provider/dist/vm.d.ts?raw';

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

## Files

- `build-dts.mjs` - Build script to generate bundled DTS files
- `test-dts.mjs` - Test script to validate generated DTS files
- `vm.ts` - View Model type definitions
- `query.ts` - Query builder type definitions
- `runtime.ts` - Runtime type re-exports
- `dist/` - Generated bundled DTS files (created by build script)

## Development

The source `.ts` files use workspace dependencies (`@gi-tcg/gts-runtime`, `arktype`) and can't be directly used in Monaco Editor. The build process resolves and inlines all type dependencies to create standalone declaration files.
