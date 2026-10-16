/* SCENTRA · Service worker (app instalable + uso sin conexión de la interfaz).
   Nunca guarda en caché las llamadas a Supabase: los datos siempre son en vivo. */
const VERSION = 'scentra-v4';
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/manifest-admin.webmanifest', '/img/logo.png', '/favicon.png', '/icons/icon-192.png'];

// La versión nueva se activa sola apenas se descarga (la app se recarga una vez con el diseño nuevo)
self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).catch(() => undefined));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (e) => {
  if (e.data === 'ACTUALIZAR') self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Fuentes de Google: caché primero
  if (url.hostname.endsWith('fonts.googleapis.com') || url.hostname.endsWith('fonts.gstatic.com')) {
    e.respondWith(cacheFirst(req));
    return;
  }
  if (url.origin !== self.location.origin) return; // Supabase y demás: directo a la red

  // Navegación: red primero, si no hay conexión se abre la app guardada
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copia = res.clone();
          caches.open(VERSION).then((c) => c.put('/index.html', copia));
          return res;
        })
        .catch(() => caches.match('/index.html')),
    );
    return;
  }

  // Archivos estáticos (js, css, imágenes): caché y actualización en segundo plano
  e.respondWith(
    caches.match(req).then((guardado) => {
      const red = fetch(req)
        .then((res) => {
          if (res.ok) {
            const copia = res.clone();
            caches.open(VERSION).then((c) => c.put(req, copia));
          }
          return res;
        })
        .catch(() => guardado);
      return guardado || red;
    }),
  );
});

function cacheFirst(req) {
  return caches.match(req).then(
    (g) => g || fetch(req).then((res) => {
      const copia = res.clone();
      caches.open(VERSION).then((c) => c.put(req, copia));
      return res;
    }),
  );
}
