const CACHE_NAME = "in-and-out-pwa-2026-08-31-v62-instant-paint";
const INDEX_URL = new URL("./index.html", self.registration.scope).href;
const APP_URL = new URL("./app.js", self.registration.scope).href;
const OPTIONAL_SHELL = [
  APP_URL,
  new URL("./manifest.webmanifest", self.registration.scope).href,
  new URL("./icon-192.png", self.registration.scope).href,
  new URL("./icon-512.png", self.registration.scope).href
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(async (cache) => {
        await cache.add(new Request(INDEX_URL, { cache: "reload" }));
        await Promise.allSettled(OPTIONAL_SHELL.map((url) => cache.add(new Request(url, { cache: "reload" }))));
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(INDEX_URL);

      const refresh = fetch(request, { cache: "no-cache" })
        .then(async (response) => {
          if (response && response.ok) await cache.put(INDEX_URL, response.clone());
          return response;
        })
        .catch(() => null);

      if (cached) {
        event.waitUntil(refresh);
        return cached;
      }
      return (await refresh) || new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
    })());
    return;
  }

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;
    try {
      const response = await fetch(request);
      if (response && response.ok) event.waitUntil(cache.put(request, response.clone()));
      return response;
    } catch (_) {
      return Response.error();
    }
  })());
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});
