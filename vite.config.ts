// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { createHash } from "node:crypto";
import type { Plugin } from "vite";

function offlineAppPlugin(): Plugin {
  return {
    name: "offline-app",
    apply: "build",
    applyToEnvironment: (environment) => environment.name === "client",
    generateBundle(_options, bundle) {
      const assets = Object.keys(bundle).filter((file) =>
        /\.(?:css|js|mjs|wasm|png|jpe?g|webp|svg|ico|woff2?)$/i.test(file),
      );
      const cacheVersion = createHash("sha256").update(assets.join("|")).digest("hex").slice(0, 12);
      const cacheName = `fit-start-daily-${cacheVersion}`;
      const worker = `
const CACHE_NAME = ${JSON.stringify(cacheName)};
const APP_SHELL = new URL("./", self.registration.scope).href;
const PRECACHE_URLS = ${JSON.stringify(assets.map((file) => `./${file}`))};

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll([APP_SHELL, ...PRECACHE_URLS]);
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith("fit-start-daily-") && key !== CACHE_NAME)
      .map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response.ok) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(request, response.clone());
        }
        return response;
      } catch {
        const cache = await caches.open(CACHE_NAME);
        return (await cache.match(request)) ?? (await cache.match(APP_SHELL));
      }
    })());
    return;
  }

  if (request.destination) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok) await cache.put(request, response.clone());
      return response;
    })());
  }
});
`;
      this.emitFile({ type: "asset", fileName: "service-worker.js", source: worker });
    },
  };
}

export default defineConfig({
  vite: {
    base: process.env["GITHUB_PAGES"] === "true" ? "/fit-start-daily/" : "/",
  },
  plugins: [offlineAppPlugin()],
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
