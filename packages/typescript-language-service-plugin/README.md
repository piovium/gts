# GamingTS TypeScript Language Service Plugin

## Technical information

This Plugin is a *TypeScript* language service plugin -- that injected into TypeScript's language server `tsserver` for providing typings for GamingTS.

It provides the ability to `tsserver` for reading GamingTS file as TypeScript module. This plugin do NOT provide type checking, just an experience improvement.

Our vscode extension, ???, automatically load this language service plugin into the `tsserver` used by vscode. But since vscode's TypeScript LSP *client* do not recognize `.gts` file and won't send it's document data to server, we manually patched the client code to treat `.gts` as native TypeScript code. This is a common technique used by Vue and Ripple, etc. See the vscode package for detail.

A notice: the plugin loading of `tsserver` only allows CommonJS and only recognizes `main` as main field of a package -- and `exports` won't work.
