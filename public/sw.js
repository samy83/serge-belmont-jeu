/*
 * Service worker minimal (hors ligne) : les fichiers de l'application sont
 * mis en cache au fur et a mesure qu'ils sont demandes ; ensuite ils sont
 * servis depuis le cache, le reseau ne servant qu'a completer. Enregistre
 * seulement en production (voir src/main.ts). Changer CACHE_NAME invalide
 * l'ancien cache au prochain chargement.
 */
const CACHE_NAME = 'serge-belmont-v1';
const PRECACHE = ['./', './index.html', './manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      // Cache d'abord (rapide, hors ligne), reseau pour rafraichir.
      return cached || network;
    }),
  );
});
