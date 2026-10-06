// Retirement worker for previously installed offline builds. Never touch IndexedDB.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    await Promise.all((await caches.keys()).filter(name => name.startsWith("wardrobe-")).map(name => caches.delete(name)));
    await self.clients.claim();
    await self.registration.unregister();
  })());
});
