// Service Worker de Encantos — habilita el uso 100% sin internet
const CACHE_NAME = 'encantos-cache-v6';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/styles.css',
  './js/db.js',
  './js/app.js',
  './js/inventario.js',
  './js/ventas.js',
  './js/clientes.js',
  './js/reportes.js',
  './js/backup.js',
  './js/busqueda-visual.js',
  'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

// Orígenes cuyos archivos SÍ queremos guardar en caché para uso sin internet
// (las librerías que cargamos desde una red pública). Todo lo demás que no
// sea del propio sitio —en especial Firestore y Firebase Auth— se deja pasar
// directo a internet, sin que el service worker lo intercepte ni lo guarde.
const ORIGENES_CACHEABLES = ['https://cdn.jsdelivr.net', 'https://www.gstatic.com'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.all(
        ASSETS.map((url) =>
          cache.add(url).catch((err) => {
            // No detener la instalación si un asset opcional aún no existe
            console.warn('No se pudo cachear', url, err);
          })
        )
      );
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  const esMismoOrigen = url.origin === self.location.origin;
  const esOrigenCacheable = ORIGENES_CACHEABLES.includes(url.origin);

  if (!esMismoOrigen && !esOrigenCacheable) {
    // Firestore, Firebase Auth y cualquier otro servicio: dejar pasar sin tocar.
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          // Guardar copia en caché para uso futuro sin internet
          if (response && response.status === 200 && event.request.method === 'GET') {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => cached);
    })
  );
});
