/**
 * ============================================================
 *  SUBLI-TECH v2 — sw.js (Service Worker)
 *  Estrategia:
 *   - Cache-First para assets estáticos (CSS, JS, imágenes, HTML)
 *   - Network-First para llamadas a la API del backend
 *   - Offline fallback cuando la red falla y no hay caché
 * ============================================================
 */

'use strict';

const CACHE_NAME     = 'sublitech-v2-cache-v1';
const API_ORIGIN     = 'http://localhost:8000';
const OFFLINE_PAGE   = '/offline.html';

// Assets que se pre-cachean en la instalación
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/login.html',
  '/carrito.html',
  '/producto.html',
  '/mis_pedidos.html',
  '/styles.css',
  '/js/api.js',
  '/js/main.js',
  '/js/auth.js',
  '/js/catalogo.js',
  '/js/carrito.js',
  '/js/producto.js',
  '/js/mis_pedidos.js',
  '/manifest.json',
  '/img/logo.png',
];

/* ── Instalación: pre-cachear assets ── */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // Intentar cachear todo; si falla alguno, continuar igual
      return Promise.allSettled(
        PRECACHE_ASSETS.map(url => cache.add(url).catch(() => {}))
      );
    }).then(() => self.skipWaiting())
  );
});

/* ── Activación: limpiar cachés viejas ── */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

/* ── Fetch: interceptar peticiones ── */
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignorar peticiones no GET (POST, PUT, DELETE — no cachear)
  if (request.method !== 'GET') return;

  // Ignorar extensiones del navegador y schemes no http
  if (!url.protocol.startsWith('http')) return;

  // ── API calls → Network-First ─────────────────────────
  if (url.origin === API_ORIGIN) {
    event.respondWith(networkFirst(request));
    return;
  }

  // ── Assets estáticos → Cache-First ───────────────────
  event.respondWith(cacheFirst(request));
});

/** Cache-First: sirve desde caché si existe, si no va a la red y guarda. */
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const networkRes = await fetch(request);
    if (networkRes && networkRes.status === 200) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkRes.clone());
    }
    return networkRes;
  } catch {
    // Sin red ni caché → página offline
    const offline = await caches.match(OFFLINE_PAGE);
    return offline || new Response('Sin conexión', { status: 503 });
  }
}

/** Network-First: intenta red, si falla usa caché. */
async function networkFirst(request) {
  try {
    const networkRes = await fetch(request);
    if (networkRes && networkRes.status === 200) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkRes.clone());
    }
    return networkRes;
  } catch {
    const cached = await caches.match(request);
    return cached || new Response(
      JSON.stringify({ error: 'Sin conexión. El backend no está disponible.' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
