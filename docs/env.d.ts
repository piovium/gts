import { default as components } from "fumadocs-ui/mdx";
type Components = typeof components;
declare global {
  export interface MDXProvidedComponents extends Components {}
}
