const CACHE_NAME = "ironlog-v17";
const APP_SHELL = [
  "./",
  "./index.html",
  "./css/style.css",
  "./js/store.js",
  "./js/exercise-library.js",
  "./js/exercise-icons.js",
  "./js/plates.js",
  "./js/warmup.js",
  "./js/badges.js",
  "./js/generator.js",
  "./js/import-strong.js",
  "./js/app.js",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Network-first so updates deploy immediately when online; falls back to the
// cached app shell when offline, which is what makes it usable at the gym
// without signal.
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
