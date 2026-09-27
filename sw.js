"use strict";

const APP_VERSION = "24";
const CACHE_PREFIX = "willy-card-counter-";
const CACHE_NAME = `${CACHE_PREFIX}v${APP_VERSION}`;
const APP_SCOPE = new URL("./", self.registration.scope);
const INDEX_URL = new URL("./index.html", APP_SCOPE).href;
const PRIVACY_URL = new URL("./privacy.html", APP_SCOPE).href;
const ASSETS = [
  "./index.html",
  "./privacy.html",
  "./bootstrap.js?v=24",
  "./style.css?v=24",
  "./app.js?v=24",
  "./manifest.json?v=24",
  "./version.json",
  "./icons/apple-touch-icon.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];
const CACHEABLE_PATHS = new Set(ASSETS.map(asset => new URL(asset, APP_SCOPE).pathname));
const CONTENT_SECURITY_POLICY = "default-src 'none'; script-src 'self'; script-src-attr 'none'; style-src 'self'; style-src-attr 'none'; img-src 'self'; font-src 'none'; connect-src 'self'; manifest-src 'self'; worker-src 'self'; child-src 'none'; base-uri 'none'; object-src 'none'; frame-src 'none'; frame-ancestors 'none'; form-action 'none'; media-src 'none'; trusted-types counter-renderer; require-trusted-types-for 'script'; block-all-mixed-content";
const EXPECTED_CONTENT_TYPES = new Map([
  [new URL("./index.html", APP_SCOPE).pathname, ["text/html"]],
  [new URL("./privacy.html", APP_SCOPE).pathname, ["text/html"]],
  [new URL("./bootstrap.js", APP_SCOPE).pathname, ["text/javascript", "application/javascript"]],
  [new URL("./app.js", APP_SCOPE).pathname, ["text/javascript", "application/javascript"]],
  [new URL("./style.css", APP_SCOPE).pathname, ["text/css"]],
  [new URL("./manifest.json", APP_SCOPE).pathname, ["application/manifest+json", "application/json"]],
  [new URL("./version.json", APP_SCOPE).pathname, ["application/json"]],
  [new URL("./icons/apple-touch-icon.png", APP_SCOPE).pathname, ["image/png"]],
  [new URL("./icons/icon-192.png", APP_SCOPE).pathname, ["image/png"]],
  [new URL("./icons/icon-512.png", APP_SCOPE).pathname, ["image/png"]]
]);

function canonicalCacheKey(url, isNavigation = false) {
  if (isNavigation) {
    return new URL(url).pathname === new URL(PRIVACY_URL).pathname ? PRIVACY_URL : INDEX_URL;
  }
  const canonicalUrl = new URL(url);
  canonicalUrl.search = "";
  canonicalUrl.hash = "";
  return canonicalUrl.href;
}

function hasExpectedContentType(url, response, isNavigation = false) {
  const contentType = (response.headers.get("Content-Type") || "").toLowerCase();
  const expected = isNavigation
    ? ["text/html"]
    : EXPECTED_CONTENT_TYPES.get(new URL(url).pathname);
  return Array.isArray(expected) && expected.some(type => contentType.startsWith(type));
}

function addSecurityHeaders(response) {
  const headers = new Headers(response.headers);
  headers.set("Content-Security-Policy", CONTENT_SECURITY_POLICY);
  headers.set("Cross-Origin-Opener-Policy", "same-origin");
  headers.set("Cross-Origin-Embedder-Policy", "require-corp");
  headers.set("Cross-Origin-Resource-Policy", "same-origin");
  headers.set("Origin-Agent-Cluster", "?1");
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

async function precacheAssets() {
  const cache = await caches.open(CACHE_NAME);
  await Promise.all(ASSETS.map(async asset => {
    const request = new Request(new URL(asset, APP_SCOPE), {
      cache: "reload",
      credentials: "same-origin"
    });
    const response = await fetch(request);
    const responseUrl = new URL(response.url || request.url);
    if (
      !response.ok
      || response.type !== "basic"
      || responseUrl.origin !== APP_SCOPE.origin
      || !hasExpectedContentType(request.url, response)
    ) {
      throw new Error(`Ressource de pré-cache refusée : ${responseUrl.pathname}`);
    }
    await cache.put(canonicalCacheKey(request.url), addSecurityHeaders(response));
  }));
}

self.addEventListener("install", event => {
  event.waitUntil(precacheAssets());
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
        if (currentUrl.pathname === new URL(PRIVACY_URL).pathname) return undefined;
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
      if (
        !networkResponse.ok
        || networkResponse.type !== "basic"
        || responseUrl.origin !== APP_SCOPE.origin
        || !hasExpectedContentType(request.url, networkResponse, isNavigation)
      ) {
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
