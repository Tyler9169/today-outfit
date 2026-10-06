const CACHE_NAME = "wardrobe-pages-3646822ec4eb0f20";
const RESOURCES = ["./","./assets/definitions-QeSOkqGU.js","./assets/index-BGasVy2r.js","./assets/index-BcMz_lYn.css","./assets/native-store-De22TiFy.js","./assets/web-D02iE8Mn.js","./assets/web-DOyZCj4T.js","./favicon.svg","./file.svg","./globe.svg","./icon-180.png","./icon-192.png","./icon-512.png","./icon-source.svg","./index.html","./manifest.webmanifest","./window.svg"].map(url => new URL(url, self.registration.scope).href);
/* globals CACHE_NAME, RESOURCES */
self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    try { await cache.addAll(RESOURCES.map(url => new Request(url, { cache: "reload" }))); }
    catch (error) { await caches.delete(CACHE_NAME); throw error; }
    // Initial installation may take control; updates wait for explicit user action.
    if (!self.registration.active) await self.skipWaiting();
  })());
});
self.addEventListener("activate", event => { event.waitUntil(self.clients.claim()); });
self.addEventListener("message", event => {
  if (event.data?.type === "ACTIVATE") self.skipWaiting();
  if (event.data?.type === "STATUS") event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    const complete = (await Promise.all(RESOURCES.map(url => cache.match(url)))).every(Boolean);
    event.ports[0]?.postMessage({ ready: complete, version: CACHE_NAME });
  })());
});
self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    if (request.mode === "navigate") return await cache.match(new URL("./", self.registration.scope).href) || fetch(request);
    // Older clients can finish using their original chunks after a version update.
    return await cache.match(request) || await caches.match(request) || fetch(request);
  })());
});
