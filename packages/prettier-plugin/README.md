# @gi-tcg/prettier-plugin-gts

Prettier plugin for GamingTS (`.gts`) card definition files.

```js
// prettier.config.mjs
export default {
  plugins: ["@gi-tcg/prettier-plugin-gts"],
};
```

The plugin uses the GTS parser from `@gi-tcg/gts-transpiler` and Prettier's
standard ESTree printer for ordinary TypeScript syntax.
