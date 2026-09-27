"use strict";

const APP_VERSION = "22";
const CACHE_PREFIX = "willy-card-counter-";
const CACHE_NAME = `${CACHE_PREFIX}v${APP_VERSION}`;
const APP_SCOPE = new URL("./", self.registration.scope);
const INDEX_URL = new URL("./index.html", APP_SCOPE).href;
const ASSETS = [
  "./index.html",
  "./bootstrap.js?v=22",
  "./style.css?v=22",
  "./app.js?v=22",
  "./manifest.json?v=22",
  "./version.json",
  "./icons/apple-touch-icon.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];
const CACHEABLE_PATHS = new Set(ASSETS.map(asset => new URL(asset, APP_SCOPE).pathname));
const CONTENT_SECURITY_POLICY = "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src 'self'; manifest-src 'self'; worker-src 'self'; base-uri 'none'; object-src 'none'; frame-src 'none'; frame-ancestors 'none'; form-action 'none'; media-src 'none'; block-all-mixed-content";

function canonicalCacheKey(url, isNavigation = false) {
  if (isNavigation) return INDEX_URL;
  const canonicalUrl = new URL(url);
  canonicalUrl.search = "";
  canonicalUrl.hash = "";
  return canonicalUrl.href;
}

function addSecurityHeaders(response) {
  const headers = new Headers(response.headers);
  headers.set("Content-Security-Policy", CONTENT_SECURITY_POLICY);
  headers.set("Cross-Origin-Opener-Policy", "same-origin");
  headers.set("Cross-Origin-Resource-Policy", "same-origin");
  headers.set("Permissions-Policy", "accelerometer=(), autoplay=(), camera=(), display-capture=(), encrypted-media=(), fullscreen=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), midi=(), payment=(), picture-in-picture=(), publickey-credentials-get=(), screen-wake-lock=(), serial=(), usb=(), web-share=(), xr-spatial-tracking=(), bluetooth=(), browsing-topics=()");
  headers.set("Referrer-Policy", "no-referrer");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  headers.set("X-Permitted-Cross-Domain-Policies", "none");

  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText
  });
}

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
      .then(() => self.clients.matchAll({ type: "window", includeUncontrolled: true }))
      .then(clients => Promise.all(clients.map(client => {
        const currentUrl = new URL(client.url);
        if (currentUrl.origin !== APP_SCOPE.origin || !currentUrl.pathname.startsWith(APP_SCOPE.pathname)) return undefined;
        if (currentUrl.searchParams.get("app") === `v${APP_VERSION}`) return undefined;
        return client
          .navigate(new URL(`./?app=v${APP_VERSION}&updated=1`, APP_SCOPE).href)
          .catch(() => undefined);
      })))
  );
});

self.addEventListener("fetch", event => {
  const { request } = event;
  if (request.method !== "GET") return;

  const requestUrl = new URL(request.url);
  const isNavigation = request.mode === "navigate";
  const isSameOrigin = requestUrl.origin === APP_SCOPE.origin;
  const isKnownAsset = CACHEABLE_PATHS.has(requestUrl.pathname);

  if (!isSameOrigin || (!isNavigation && !isKnownAsset)) return;

  event.respondWith((async () => {
    const cacheKey = canonicalCacheKey(request.url, isNavigation);
    try {
      const networkResponse = await fetch(request, {
        cache: "no-store",
        credentials: "same-origin"
      });
      const responseUrl = new URL(networkResponse.url || request.url);
      if (!networkResponse.ok || networkResponse.type !== "basic" || responseUrl.origin !== APP_SCOPE.origin) {
        throw new Error("Réponse réseau non fiable");
      }

      const securedResponse = addSecurityHeaders(networkResponse);
      const cache = await caches.open(CACHE_NAME);
      await cache.put(cacheKey, securedResponse.clone());
      return securedResponse;
    } catch {
      const cachedResponse = await caches.match(cacheKey) || await caches.match(request);
      if (cachedResponse) return addSecurityHeaders(cachedResponse.clone());
      return new Response("Application indisponible hors ligne.", {
        status: 503,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Referrer-Policy": "no-referrer",
          "X-Content-Type-Options": "nosniff"
        }
      });
    }
  })());
});
