// Biblioteca Virtual - service worker
// Guarda la app para abrirla sin internet y sirve los PDF descargados.
const APP_CACHE = 'bv-app-v1';
const DOCS_CACHE = 'bv-docs';
const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
  PDFJS + 'pdf.min.js',
  PDFJS + 'pdf.worker.min.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(APP_CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('bv-app-') && k !== APP_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Lista de documentos: siempre de la red (la app guarda su propia copia).
  if (url.hostname === 'api.github.com') return;

  // PDF: primero el descargado en el teléfono; si no está, de la red.
  if (url.pathname.toLowerCase().endsWith('.pdf')) {
    e.respondWith(caches.open(DOCS_CACHE).then((c) => c.match(req.url)).then((hit) => hit || fetch(req)));
    return;
  }

  // Abrir la app sin internet.
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then((res) => {
      const copy = res.clone();
      caches.open(APP_CACHE).then((c) => c.put('./index.html', copy));
      return res;
    }).catch(() => caches.match('./index.html')));
    return;
  }

  // Resto de la app: lo guardado primero y se actualiza por detrás.
  if (url.origin === location.origin || req.url.startsWith(PDFJS)) {
    e.respondWith(caches.open(APP_CACHE).then((c) => c.match(req).then((hit) => {
      const net = fetch(req).then((res) => { if (res.ok) c.put(req, res.clone()); return res; }).catch(() => hit);
      return hit || net;
    })));
  }
});
