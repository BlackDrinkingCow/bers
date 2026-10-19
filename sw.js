// Offline shell: the app opens without internet (your closet is on the phone). Picks still need internet.
// App files are network-first (updates show up on next open), with the cache as the offline fallback.
const VERSION = "bers-v5";
const SHELL = ["./", "index.html", "styles.css", "manifest.webmanifest", "js/app.js", "js/db.js", "js/ai.js", "js/weather.js", "js/image.js","fonts/NewRocker-Regular.woff2",
  "icons/icon.svg", "icons/icon-180.png", "icons/icon-192.png", "icons/icon-512.png"];

self.addEventListener("install", (e) => { e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL))); self.skipWaiting(); });
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  if (u.origin === location.origin) {
    // "no-cache" = always ask GitHub if the file changed (a quick 304 if not), so updates show on the next open.
    e.respondWith(fetch(e.request, { cache: "no-cache" }).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(e.request, copy)); }
      return res;
    }).catch(() => caches.match(e.request, { ignoreSearch: true })));
  } else if (u.hostname === "esm.sh") {
    // The Claude SDK is pinned to a version, so once cached it never changes.
    e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(e.request, copy)); }
      return res;
    })));
  }
});
