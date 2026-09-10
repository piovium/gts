#!/usr/bin/env node
if (process.argv.includes("--version")) {
  const { default: packageJson } = await import("../package.json", {
    with: { type: "json" },
  });
  console.log(packageJson.version);
} else {
  await import("../dist/node.js");
}
