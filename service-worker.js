// ═══════════════════════════════════════════════════════════
//  SERVICE WORKER – Cunoașterea Generală a Aeronavei Planor
//  Strategie: Cache-First pentru resurse esențiale
//  Audio și infografice mari → Network-only (nu se cache-uiesc)
// ═══════════════════════════════════════════════════════════

const CACHE_NAME = 'planorism-v1';

// Resurse esențiale – aplicația funcționează 100% offline cu acestea
// (tot conținutul lecțiilor, quiz-urilor și esențialelor este inline în HTML)
const CORE_ASSETS = [
  './index.html',
  './cunoasterea_generala_aeronavei_planor.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './favicon.ico',
  './foto_planor.jpg',
  './siglaaeroclub.png',
  './by_arca_method.PNG'
];

// Fișiere mari care NU se cache-uiesc (audio 3–57MB, infografice 6MB)
const NO_CACHE_PATTERNS = [
  /\.m4a$/i,
  /\.mp3$/i,
  /_(a|b|c)_cgp\.(png|jpg|jpeg)$/i,
  /[0-9]+_cgp\.(png|jpg|jpeg)$/i,
  /[0-9]+[a-c]?_cgp/i
];

// ── INSTALL: pre-cache resurse esențiale ──────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[SW] Pre-caching core assets');
      return cache.addAll(CORE_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// ── ACTIVATE: șterge cache-urile vechi ───────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => {
          console.log('[SW] Deleting old cache:', k);
          return caches.delete(k);
        })
      )
    ).then(() => self.clients.claim())
  );
});

// ── FETCH: strategia de servire ──────────────────────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Ignoră requesturi non-http (chrome-extension etc.)
  if (!event.request.url.startsWith('http')) return;

  // Fișiere mari → Network-only, nu le cache-uim
  const isLargeFile = NO_CACHE_PATTERNS.some(p => p.test(url.pathname));
  if (isLargeFile) {
    event.respondWith(fetch(event.request).catch(() =>
      new Response('Fișierul audio/infografic necesită conexiune la internet.', {
        status: 503,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      })
    ));
    return;
  }

  // Resurse esențiale → Cache-First, fallback Network
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;

      return fetch(event.request).then(response => {
        // Cache-uiește răspunsurile valide
        if (response && response.status === 200 && response.type === 'basic') {
          const toCache = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, toCache));
        }
        return response;
      }).catch(() => {
        // Fallback offline pentru HTML
        if (event.request.headers.get('accept').includes('text/html')) {
          return caches.match('./index.html');
        }
      });
    })
  );
});
