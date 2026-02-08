# Patches

This directory contains patches for third-party packages that are applied automatically by Bun during `bun install`.

## Why Patches?

Previously, the codebase used runtime monkey-patching (modifying objects at runtime using Proxy patterns and direct property modifications). This approach:
- Made code hard to read and understand
- Hid behavior changes in complex Proxy logic
- Made debugging more difficult
- Potentially affected performance with Proxy-based interception

By using install-time patches instead, the modifications are:
- Explicit and visible in source control
- Applied once during installation, not at every runtime
- Easier to understand and maintain
- No runtime performance overhead
- Documented in this directory

## Current Patches

### acorn@8.15.0

**File**: `acorn@8.15.0.patch`

**Purpose**: Adds GTS-specific parse options to the acorn JavaScript parser

**Modifications**:
1. **parseIdentNode** function:
   - Added `allowEmptyMemberAccess` option support
   - When enabled, creates dummy identifiers (name: '✖', isDummy: true) instead of throwing errors
   - Used for incomplete code in language tooling (e.g., `obj.` without property name)

2. **parseSubscript** function:
   - Added `recordLParenOfCall` option support
   - When enabled, records the location of opening parenthesis in CallExpression nodes
   - Adds `lParenLoc` property with start/end location for precise source mapping

3. **parseNew** function:
   - Added `recordLParenOfCall` option support
   - When enabled, records the location of opening parenthesis in NewExpression nodes
   - Adds `lParenLoc` property with start/end location for precise source mapping

**Why needed**: These options eliminate the need for Proxy-based parser plugins that wrapped parser methods at runtime. The Proxy pattern added complexity and potential performance overhead.

**Impact**: Removed 120+ lines of Proxy-based plugin code (`loose_plugin.ts` and `record_call_lparen_plugin.ts`), significantly improving code readability and performance.

### esrap@2.2.1

**File**: `esrap@2.2.1.patch`

**Purpose**: Adds GTS-specific features to the esrap TypeScript printer

**Modifications**:
1. **Identifier handler** (`Identifier` function):
   - Checks for `isDummy` property on identifier nodes
   - Writes an empty string for dummy identifiers (used for incomplete code in language tooling)
   
2. **CallExpression/NewExpression handler** (`CallExpression|NewExpression` function):
   - Supports custom `lParenLoc` property for precise source mapping
   - Allows the opening parenthesis to have a custom location for Volar/language server features

**Why needed**: These features are required for GTS language tooling to provide accurate source maps and handle incomplete code during editing.

**Impact**: Without this patch, the transpiler would need to use complex runtime Proxy patterns to achieve the same behavior (70+ lines of code that was removed after introducing this patch).

## How Patches Are Applied

Patches are automatically applied by **Bun's native patch mechanism** using the `patchedDependencies` field in `package.json`:

```json
{
  "patchedDependencies": {
    "acorn@8.15.0": "patches/acorn@8.15.0.patch",
    "esrap@2.2.1": "patches/esrap@2.2.1.patch"
  }
}
```

When you run `bun install`:
1. Bun reads the `patchedDependencies` field
2. Installs the specified package versions
3. Automatically applies the patches from the specified files
4. No custom scripts needed!

## Maintaining Patches

### Creating a New Patch

If you need to modify a third-party package:

1. Run `bun patch <package-name>@<version>` to prepare the package for editing
2. Make your changes to the files in node_modules
3. Run `bun patch --commit 'node_modules/<package-name>'` to generate the patch
4. The patch file will be created in this directory
5. Add the patch to `patchedDependencies` in root `package.json`
6. Update this README to document the patch

### Updating an Existing Patch

If a package version changes:

1. Follow the "Creating a New Patch" steps above
2. Replace the old patch file with the new one
3. Update the version number in the patch filename, `patchedDependencies` field, and this README
4. Test that the patch applies correctly after a clean install

### Testing Patches

After creating or modifying a patch:

```bash
# Clean install
rm -rf node_modules
bun install

# Verify acorn patch was applied
grep "GTS patch" node_modules/.bun/acorn@*/node_modules/acorn/dist/acorn.mjs

# Verify esrap patch was applied
grep "GTS patch" node_modules/.bun/esrap@*/node_modules/esrap/src/languages/ts/index.js

# Run tests
cd packages/transpiler
bun test
```

## Troubleshooting

### Patch fails to apply

- Check that the package version in `patchedDependencies` matches the patch filename
- Verify the package structure hasn't changed
- Re-create the patch following the steps above
- Check bun's output for specific error messages

### Patch not being applied

- Ensure the `patchedDependencies` field is correctly formatted in `package.json`
- Verify the patch file exists at the specified path
- Check that the patch file is readable
- Try cleaning the bun cache: `rm -rf ~/.bun/install/cache`

### Package version conflicts

- If you see version conflicts, ensure all workspaces use compatible versions
- The patch version must exactly match the installed package version

## References

- [Bun patch documentation](https://bun.sh/docs/cli/patch)
- [Original refactoring PR](https://github.com/piovium/gts/pull/XXX) - TODO: Update with actual PR number
