#!/usr/bin/env node
if (process.argv.includes("--version")) {
  const { default: pkgJSON } = await import("../package.json", { with: { type: "json" } });
  console.log(pkgJSON.version);
} else {
  await import("../dist/node.js");
}
