const APP_VERSION = "16";
const CACHE_NAME = `willy-card-counter-v${APP_VERSION}`;
const ASSETS = [
  "./index.html",
  "./?app=v16",
  "./style.css?v=16",
  "./app.js?v=16",
  "./manifest.json?v=16",
  "./version.json",
  "./icons/apple-touch-icon.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
      .then(() => self.clients.matchAll({ type: "window", includeUncontrolled: true }))
      .then(clients => Promise.all(clients.map(client => {
        const currentUrl = new URL(client.url);
        if (currentUrl.searchParams.get("app") === `v${APP_VERSION}`) return undefined;
        return client
          .navigate(new URL(`./?app=v${APP_VERSION}&updated=1`, self.registration.scope).href)
          .catch(() => undefined);
      })))
  );
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    fetch(event.request, { cache: "no-store" }).then(response => {
      if (response.ok && response.type === "basic") {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
      }
      return response;
    }).catch(() => caches.match(event.request).then(cached => (
      cached || (event.request.mode === "navigate" ? caches.match("./index.html") : undefined)
    )))
  );
});
