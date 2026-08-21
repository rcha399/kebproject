const CACHE = "seat-signal-v1";

const ASSETS = [
  "./index.html",
  "./heatmap.html",
  "./zone.html",
  "./style.css",
  "./data.js",
  "./app.js",
  "./heatmap.js",
  "./zone.js",
  "./manifest.json",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
];

self.addEventListener("install", (evt) => {
  evt.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (evt) => {
  evt.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Network-first for same-origin requests, falling back to cache when offline.
// Keeps live seat data fresh when online, but still shows the last-known
// state (and lets the app open at all) when the connection drops.
self.addEventListener("fetch", (evt) => {
  if (evt.request.method !== "GET") return;

  evt.respondWith(
    fetch(evt.request)
      .then((res) => {
        const clone = res.clone();
        caches.open(CACHE).then((cache) => cache.put(evt.request, clone));
        return res;
      })
      .catch(() => caches.match(evt.request))
  );
});
