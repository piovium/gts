# Patches

This directory contains patches for third-party packages that are applied during `bun install` via the postinstall script.

## Why Patches?

Previously, the codebase used runtime monkey-patching (modifying objects at runtime using Proxy patterns and direct property modifications). This approach:
- Made code hard to read and understand
- Hid behavior changes in complex Proxy logic
- Made debugging more difficult

By using install-time patches instead, the modifications are:
- Explicit and visible in source control
- Applied once during installation, not at every runtime
- Easier to understand and maintain
- Documented in this directory

## Current Patches

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

Patches are automatically applied by the `scripts/apply-patches.sh` script, which is run via the postinstall hook in `package.json`.

The script:
1. Detects the package manager being used (bun, npm, pnpm)
2. Finds the correct node_modules location
3. Applies all patches in this directory
4. Reports success or warnings

## Maintaining Patches

### Creating a New Patch

If you need to modify a third-party package:

1. Run `bun patch <package-name>@<version>` to prepare the package for editing
2. Make your changes to the files in node_modules
3. Run `bun patch --commit 'node_modules/<package-name>'` to generate the patch
4. The patch file will be created in this directory
5. Update this README to document the patch

### Updating an Existing Patch

If a package version changes:

1. Follow the "Creating a New Patch" steps above
2. Replace the old patch file with the new one
3. Update the version number in the patch filename and this README
4. Test that the patch applies correctly after a clean install

### Testing Patches

After creating or modifying a patch:

```bash
# Clean install
rm -rf node_modules
bun install

# Verify patch was applied
grep "GTS patch" node_modules/.bun/esrap@*/node_modules/esrap/src/languages/ts/index.js

# Run tests
cd packages/transpiler
bun test
```

## Troubleshooting

### Patch fails to apply

- Check that the package version matches the patch filename
- Verify the package structure hasn't changed
- Re-create the patch following the steps above

### Patch not being applied

- Ensure the postinstall script is being run
- Check that `scripts/apply-patches.sh` is executable (`chmod +x`)
- Verify the patch file exists and is readable

## References

- [Bun patch documentation](https://bun.sh/docs/cli/patch)
- [Original refactoring PR](https://github.com/piovium/gts/pull/XXX) - TODO: Update with actual PR number
