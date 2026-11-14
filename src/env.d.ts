/// <reference types="astro/client" />

interface Window {
  dataLayer?: Record<string, unknown>[];
}

declare const Netlify: {
  env: {
    get(name: string): string | undefined;
  };
};
