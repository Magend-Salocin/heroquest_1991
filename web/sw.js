// Mode hors ligne du site publié : met en cache tous les fichiers du site, les sert depuis le
// cache d'abord, et supprime les anciennes versions. La liste et la version viennent de
// precache-manifest.js, écrit par outils/construire-site.mjs (absent en local et du dépôt).
// Le paquet de données n'est pas ici : il est dans IndexedDB (jeu/paquet.js).

importScripts('precache-manifest.js');

const PREFIXE = 'heroquest-1991-';
const CACHE = PREFIXE + self.PRECACHE.version;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(self.PRECACHE.fichiers)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((noms) => Promise.all(noms.filter((n) => n.startsWith(PREFIXE) && n !== CACHE).map((n) => caches.delete(n))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const requete = e.request;
  if (requete.method !== 'GET' || new URL(requete.url).origin !== location.origin) return;
  e.respondWith(caches.match(requete, { ignoreSearch: true }).then((reponse) => reponse || fetch(requete)));
});
