/// <reference types="vite/client" />

// Allow importing CSS files as side effects
declare module "*.css" {
  const content: Record<string, string>;
  export default content;
}

// Allow importing SVG as URL strings
declare module "*.svg" {
  const src: string;
  export default src;
}
