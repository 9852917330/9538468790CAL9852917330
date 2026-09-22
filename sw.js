/* Service Worker V68
   Mục tiêu: mở app tức thì (cache-first) NHƯNG đẩy được code mới xuống máy
   mà không cần ai xoá cache bằng tay.
   Cách làm: trả bản cache ngay cho nhanh, đồng thời tải bản mới ở nền; khi bản mới
   khác bản đang dùng thì báo cho trang để trang tự nạp lại đúng MỘT lần. */
const BUILD = "2026-09-22-v76-body-anchor";
const CACHE_NAME = `in-and-out-pwa-${BUILD}`;
const INDEX_URL = new URL("./index.html", self.registration.scope).href;
const APP_URL = new URL("./app.js", self.registration.scope).href;
const ROOT_URL = new URL("./", self.registration.scope).href;
const OPTIONAL_SHELL = [
  ROOT_URL,
  APP_URL,
  new URL("./manifest.webmanifest", self.registration.scope).href,
  new URL("./icon-192.png", self.registration.scope).href,
  new URL("./icon-512.png", self.registration.scope).href
];
/* Hai file này quyết định app chạy đúng hay sai nên luôn được kiểm tra bản mới ở nền. */
const REVALIDATE = new Set([INDEX_URL, APP_URL, ROOT_URL]);

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

async function notifyClients(url) {
  const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  clients.forEach((client) => client.postMessage({ type: "ASSET_UPDATED", url, build: BUILD }));
}

/* So sánh nội dung thay vì tin vào header: GitHub Pages đôi khi trả 200 kèm body cũ. */
async function revalidate(cache, request, cachedResponse) {
  try {
    const fresh = await fetch(request, { cache: "no-cache" });
    if (!fresh || !fresh.ok) return;
    const freshClone = fresh.clone();
    if (cachedResponse) {
      const [a, b] = await Promise.all([cachedResponse.clone().text(), fresh.clone().text()]);
      if (a === b) return;
    }
    await cache.put(request, freshClone);
    await notifyClients(request.url);
  } catch (_) {}
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(INDEX_URL);
      if (cached) {
        event.waitUntil(revalidate(cache, new Request(INDEX_URL), cached));
        return cached;
      }
      try {
        const response = await fetch(request, { cache: "no-cache" });
        if (response && response.ok) await cache.put(INDEX_URL, response.clone());
        return response;
      } catch (_) {
        return new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) {
      if (REVALIDATE.has(url.href)) event.waitUntil(revalidate(cache, request, cached));
      return cached;
    }
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
