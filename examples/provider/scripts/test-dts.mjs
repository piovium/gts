#!/usr/bin/env node

/**
 * Simple test to verify the generated DTS files
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, "../dist");

console.log("Testing generated DTS files...\n");

let allPassed = true;

function test(name, condition, message) {
  if (condition) {
    console.log(`✓ ${name}`);
  } else {
    console.error(`✗ ${name}: ${message}`);
    allPassed = false;
  }
}

// Test 1: Files exist
const files = ["vm.d.ts", "query.d.ts", "runtime.d.ts"];
files.forEach((file) => {
  const filePath = path.join(distDir, file);
  test(
    `${file} exists`,
    fs.existsSync(filePath),
    `File not found: ${filePath}`
  );
});

// Test 2: Files are not empty
files.forEach((file) => {
  const filePath = path.join(distDir, file);
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, "utf8");
    test(
      `${file} is not empty`,
      content.length > 100,
      `File is too small: ${content.length} bytes`
    );
  }
});

// Test 3: No import statements (should be bundled)
files.forEach((file) => {
  const filePath = path.join(distDir, file);
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, "utf8");
    const hasImports = /^import\s+.*from\s+['"][^'"]+['"]/m.test(content);
    test(
      `${file} has no import statements`,
      !hasImports,
      "Found import statements in bundled file"
    );
  }
});

// Test 4: Files have expected exports
const expectedExports = {
  "query.d.ts": ["QueryBuilder", "Query", "query"],
  "runtime.d.ts": ["Meta", "Action", "View", "defineViewModel"],
  "vm.d.ts": ["registered", "default"],
};

Object.entries(expectedExports).forEach(([file, exports]) => {
  const filePath = path.join(distDir, file);
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, "utf8");
    exports.forEach((exportName) => {
      let hasExport;
      if (exportName === "query" || exportName === "default") {
        // Special case for default exports
        hasExport = /export\s+default\s+(function\s+\w+|defineViewModel)/.test(content);
      } else {
        hasExport =
          new RegExp(`export\\s+(interface|type|const|class|function)\\s+${exportName}\\b`).test(content) ||
          new RegExp(`export\\s+\\{[^}]*\\b${exportName}\\b[^}]*\\}`).test(content);
      }
      test(
        `${file} exports '${exportName}'`,
        hasExport,
        `Expected export not found: ${exportName}`
      );
    });
  }
});

// Test 5: Files have header comments
files.forEach((file) => {
  const filePath = path.join(distDir, file);
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, "utf8");
    const hasHeader = content.startsWith("/**");
    test(
      `${file} has header comment`,
      hasHeader,
      "Missing header comment"
    );
  }
});

console.log("\n" + (allPassed ? "✓ All tests passed!" : "✗ Some tests failed"));
process.exit(allPassed ? 0 : 1);
