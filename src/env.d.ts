/// <reference types="astro/client" />

declare module "*.html?raw" {
  const src: string;
  export default src;
}

interface Window {
  dataLayer?: Record<string, unknown>[];
}

declare const Netlify: {
  env: {
    get(name: string): string | undefined;
  };
};
