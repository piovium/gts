#!/usr/bin/env node

/**
 * Custom DTS bundler for provider files
 * Generates standalone .d.ts files that bundle all external type dependencies
 * This is a simple inliner that doesn't require TypeScript at build time
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const distDir = path.join(projectRoot, "dist");

// Ensure dist directory exists
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

console.log("Generating bundled TypeScript declarations...\n");

// Read runtime source files from @gi-tcg/gts-runtime
const runtimeSrcPath = path.resolve(projectRoot, "../../packages/runtime/src");
const runtimeTypes = {};

function loadRuntimeTypes() {
  const files = ["symbols.ts", "view.ts", "view_model.ts"];
  
  for (const file of files) {
    const filePath = path.join(runtimeSrcPath, file);
    if (fs.existsSync(filePath)) {
      let content = fs.readFileSync(filePath, "utf8");
      // Remove import statements
      content = content.replace(/^import\s+.*from\s+['"][^'"]+['"]\s*;?\s*$/gm, "");
      // Remove export default
      content = content.replace(/export\s+default\s+/g, "export ");
      runtimeTypes[file] = content.trim();
    }
  }
}

loadRuntimeTypes();

// Combine all runtime types into one block
const runtimeTypesBundle = Object.values(runtimeTypes).filter(Boolean).join("\n\n");

// Helper function to create bundled DTS
function createBundledDTS(inputFile, header) {
  const inputPath = path.join(projectRoot, inputFile);
  let content = fs.readFileSync(inputPath, "utf8");
  
  // Remove imports that we're bundling (including multiline imports)
  // This regex matches import statements across multiple lines
  content = content.replace(/import\s+(?:[\s\S]*?)\s+from\s+['"]\.\/runtime['"]\s*;?/g, "");
  content = content.replace(/import\s+(?:[\s\S]*?)\s+from\s+['"]\.\/query['"]\s*;?/g, "");
  content = content.replace(/import\s+(?:[\s\S]*?)\s+from\s+['"]@gi-tcg\/gts-runtime['"]\s*;?/g, "");
  
  // For arktype, remove the import but keep type usage
  content = content.replace(/import\s+\{\s*type\s*\}\s+from\s+['"]arktype['"]\s*;?/g, "");
  content = content.replace(/\btype\(/g, "/*type(*/undefined as any/*)*/ as ");
  
  // Clean up extra blank lines
  content = content.replace(/\n{3,}/g, "\n\n").trim();
  
  return header + content;
}

// Generate runtime.d.ts
console.log("Processing runtime.ts...");
{
  const header = `/**
 * Bundled type definitions for runtime.ts
 * Generated automatically - do not edit directly
 * 
 * This file re-exports all types from @gi-tcg/gts-runtime
 */

`;
  
  const content = header + runtimeTypesBundle;
  const outputPath = path.join(distDir, "runtime.d.ts");
  fs.writeFileSync(outputPath, content, "utf8");
  console.log("  ✓ Generated runtime.d.ts");
}

// Generate query.d.ts
console.log("Processing query.ts...");
{
  const header = `/**
 * Bundled type definitions for query.ts
 * Generated automatically - do not edit directly
 */

`;
  
  const content = createBundledDTS("query.ts", header);
  const outputPath = path.join(distDir, "query.d.ts");
  fs.writeFileSync(outputPath, content, "utf8");
  console.log("  ✓ Generated query.d.ts");
}

// Generate vm.d.ts
console.log("Processing vm.ts...");
{
  const header = `/**
 * Bundled type definitions for vm.ts
 * Generated automatically - do not edit directly
 * 
 * This file bundles types from runtime.ts and query.ts
 */

`;
  
  // First, inline query types
  const queryPath = path.join(projectRoot, "query.ts");
  let queryContent = fs.readFileSync(queryPath, "utf8");
  queryContent = queryContent.replace(/^export\s+/gm, "");
  
  // Then the vm content
  const vmContent = createBundledDTS("vm.ts", "");
  
  // Combine: runtime types + query types + vm content
  const content = header + "\n// === Runtime Types ===\n\n" + runtimeTypesBundle + 
                  "\n\n// === Query Types ===\n\n" + queryContent + 
                  "\n\n// === VM Definitions ===\n\n" + vmContent;
  
  const outputPath = path.join(distDir, "vm.d.ts");
  fs.writeFileSync(outputPath, content, "utf8");
  console.log("  ✓ Generated vm.d.ts");
}

console.log("\n✓ DTS bundle generation complete!");
console.log(`Output directory: ${distDir}`);
