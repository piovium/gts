/**
 * Example: Using bundled DTS files in Monaco Editor
 * 
 * This demonstrates how to integrate the generated DTS bundles
 * into a Monaco Editor instance for type checking and IntelliSense.
 */

import * as monaco from 'monaco-editor';

// Step 1: Import the bundled DTS files as raw strings
// (Using Vite's ?raw suffix)
import vmDts from '@example/provider/dist/vm?raw';
import queryDts from '@example/provider/dist/query?raw';
import runtimeDts from '@example/provider/dist/runtime?raw';

// Step 2: Configure TypeScript compiler options
monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
  target: monaco.languages.typescript.ScriptTarget.ESNext,
  allowNonTsExtensions: true,
  moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
  module: monaco.languages.typescript.ModuleKind.ESNext,
  lib: ['ESNext'],
});

// Step 3: Add the bundled type definitions as extra libraries
// These provide IntelliSense and type checking in the editor
monaco.languages.typescript.typescriptDefaults.addExtraLib(
  runtimeDts,
  'file:///node_modules/@gts/runtime.d.ts'
);

monaco.languages.typescript.typescriptDefaults.addExtraLib(
  queryDts,
  'file:///node_modules/@gts/query.d.ts'
);

monaco.languages.typescript.typescriptDefaults.addExtraLib(
  vmDts,
  'file:///node_modules/@gts/vm.d.ts'
);

// Step 4: Create the editor with example code
const editor = monaco.editor.create(document.getElementById('editor-container'), {
  value: `// Example GTS code with full IntelliSense

import { defineViewModel } from '@gts/runtime';
import { Query } from '@gts/query';

// Your code here will have full type checking and autocomplete!
`,
  language: 'typescript',
  theme: 'vs-dark',
  automaticLayout: true,
});

// Now users can write code with full IntelliSense for:
// - defineViewModel and other runtime utilities
// - Query types and QueryBuilder
// - All VM builder types (CharacterBuilder, SkillBuilder, etc.)

console.log('Monaco Editor initialized with GTS type definitions!');
