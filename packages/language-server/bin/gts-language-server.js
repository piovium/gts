#!/usr/bin/env node
if (process.argv.includes("--version")) {
  const pkgJSON = await import("../package.json");
  console.log(`${pkgJSON["version"]}`);
} else {
  await import("../dist/index.js");
}
