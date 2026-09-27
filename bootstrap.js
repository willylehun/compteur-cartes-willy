(() => {
  "use strict";

  const BUILD = "23";
  const CACHE_PREFIX = "willy-card-counter-";
  const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

  if (window.top !== window.self) {
    document.documentElement.textContent = "";
    try { window.top.location = window.self.location.href; } catch {}
    return;
  }

  if (window.location.protocol === "http:" && !LOCAL_HOSTS.has(window.location.hostname)) {
    const secureUrl = new URL(window.location.href);
    secureUrl.protocol = "https:";
    window.location.replace(secureUrl.href);
    return;
  }

  try {
    Object.defineProperty(window, "__COUNTER_BUILD__", {
      configurable: false,
      enumerable: false,
      value: BUILD,
      writable: false
    });
  } catch {
    window.__COUNTER_BUILD__ = BUILD;
  }

  try {
    const previousBuild = localStorage.getItem("willy-card-build");
    localStorage.setItem("willy-card-build", BUILD);
    if (previousBuild !== BUILD && "caches" in window) {
      caches.keys().then(keys => Promise.all(
        keys
          .filter(key => key.startsWith(CACHE_PREFIX))
          .map(key => caches.delete(key))
      )).catch(() => {});
    }
  } catch {}
})();
