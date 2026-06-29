/* Service worker — disponibilité hors-ligne.
   Précache la coquille de l'app + la traduction par défaut ; le reste
   (autres traductions, interlinéaire, Strong, réf. croisées) est mis en
   cache à la première consultation (cache-first). */
const CACHE = "bible-offline-v7";

const PRECACHE = [
  "./", "./index.html", "./manifest.webmanifest",
  "./styles.css", "./lib.js", "./data-online.js", "./app.js",
  "./icon.svg", "./icon-192.png", "./icon-512.png",
  "./data/ls1910.js"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    }).catch(() => hit))
  );
});
