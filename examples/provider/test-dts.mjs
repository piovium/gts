#!/usr/bin/env node
/**
 * Test script to validate generated DTS bundles
 * Ensures:
 * 1. All three DTS files exist
 * 2. None of them have imports
 * 3. They contain expected exports
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = join(__dirname, 'dist');

const tests = [
  {
    file: 'runtime.d.ts',
    requiredExports: [
      'Action',
      'Prelude',
      'Meta',
      'NamedDefinition',
      'SingleAttributeNode',
      'NamedAttributesNode',
      'View',
      'defineViewModel',
      'defineSimpleViewModel',
      'AttributeReturn'
    ]
  },
  {
    file: 'query.d.ts',
    requiredExports: [
      'QueryBuilder',
      'Query',
      'query'
    ]
  },
  {
    file: 'vm.d.ts',
    requiredExports: [
      'registered',
      'Query',
      'QueryBuilder'
    ]
  }
];

console.log('Testing generated DTS bundles...\n');

let allPassed = true;

for (const { file, requiredExports } of tests) {
  console.log(`Testing ${file}...`);
  const filePath = join(distDir, file);
  
  // Test 1: File exists
  if (!existsSync(filePath)) {
    console.error(`  ✗ File does not exist: ${file}`);
    allPassed = false;
    continue;
  }
  console.log(`  ✓ File exists`);
  
  // Test 2: Read content
  const content = readFileSync(filePath, 'utf8');
  
  // Test 3: No imports
  const hasImports = /^import\s+/m.test(content) || /^export\s+.*\s+from\s+/m.test(content);
  if (hasImports) {
    console.error(`  ✗ File contains imports - should be standalone`);
    allPassed = false;
  } else {
    console.log(`  ✓ No imports - file is standalone`);
  }
  
  // Test 4: Required exports exist
  let missingExports = [];
  for (const exportName of requiredExports) {
    // Check for various export patterns
    const patterns = [
      new RegExp(`export\\s+(declare\\s+)?(const|let|var|function|class|interface|type|namespace)\\s+${exportName}\\b`),
      new RegExp(`export\\s+(declare\\s+)?{[^}]*\\b${exportName}\\b[^}]*}`),
      new RegExp(`export\\s+default\\s+.*${exportName}`),
    ];
    
    const found = patterns.some(pattern => pattern.test(content));
    if (!found) {
      missingExports.push(exportName);
    }
  }
  
  if (missingExports.length > 0) {
    console.error(`  ✗ Missing exports: ${missingExports.join(', ')}`);
    allPassed = false;
  } else {
    console.log(`  ✓ All required exports present`);
  }
  
  console.log('');
}

if (allPassed) {
  console.log('✓ All tests passed!');
  process.exit(0);
} else {
  console.error('✗ Some tests failed!');
  process.exit(1);
}
