// ========================================
// 古文単語315 SRS - Service Worker
// 作成日時: 2026-03-26T22:00:00+09:00
// ========================================

var CACHE_NAME = "kobutan315-srs-v1";

var ASSETS = [
  "./", "./index.html", "./manifest.json", "./icon-192.png", "./icon-512.png"
];

self.addEventListener("install", function(event) {
  event.waitUntil(caches.open(CACHE_NAME).then(function(cache) { return cache.addAll(ASSETS); }));
  self.skipWaiting();
});

self.addEventListener("activate", function(event) {
  event.waitUntil(caches.keys().then(function(names) {
    return Promise.all(names.filter(function(name) { return name !== CACHE_NAME; }).map(function(name) { return caches.delete(name); }));
  }));
  self.clients.claim();
});

self.addEventListener("fetch", function(event) {
  if (!event.request.url.startsWith("http")) return;
  if (event.request.url.includes("script.google.com") || event.request.url.includes("script.googleusercontent.com")) return;
  if (event.request.url.includes("cdnjs.cloudflare.com")) return;
  event.respondWith(
    fetch(event.request).then(function(response) {
      var clone = response.clone();
      caches.open(CACHE_NAME).then(function(cache) { cache.put(event.request, clone); });
      return response;
    }).catch(function() { return caches.match(event.request); })
  );
});
