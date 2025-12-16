const CACHE_VERSION = 1;
const CACHE_NAME = `cya-v${CACHE_VERSION}`;
const RUNTIME_CACHE = `cya-runtime-v${CACHE_VERSION}`;

const urlsToCache = [
  '/',
  '/landing.html',
  '/login.html',
  '/dashboard.html',
  '/game.html',
  '/games.html',
  '/leaderboard.html',
  '/admin.html',
  '/profile.html',
  '/offline.html',
  '/manifest.json',
  '/css/style.css',
  '/css/dashboard.css',
  '/css/games.css',
  '/css/landing.css',
  '/js/dashboard.js',
  '/js/session.js'
];

// Install event - cache essential files
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Cache all files, but don't fail installation if some optional files are missing
      return Promise.allSettled(
        urlsToCache.map(url => 
          fetch(url).then(response => {
            if (response.status === 200) {
              return cache.put(url, response);
            }
          }).catch(() => {
            // Silently skip files that can't be fetched (non-critical CSS, JS)
          })
        )
      );
    }).then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // Delete old caches but keep current ones
          if (cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - intelligent caching strategy
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  const url = new URL(event.request.url);

  // API requests - network-first with fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request, { credentials: 'include' })
        .then((response) => {
          if (response.status === 200) {
            // Cache successful API responses
            const responseToCache = response.clone();
            caches.open(RUNTIME_CACHE).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return response;
        })
        .catch(() => {
          // Return cached API response if offline
          return caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            return new Response(
              JSON.stringify({ error: 'Offline - API unavailable' }),
              { 
                status: 503,
                headers: { 'Content-Type': 'application/json' } 
              }
            );
          });
        })
    );
    return;
  }

  // HTML pages - network-first
  if (event.request.destination === 'document') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.status === 200) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return response;
        })
        .catch(() => {
          return caches.match(event.request).then((cachedResponse) => {
            return cachedResponse || caches.match('/offline.html');
          });
        })
    );
    return;
  }

  // CSS, JS, and other assets - cache-first
  event.respondWith(
    caches.match(event.request).then((response) => {
      if (response) {
        return response;
      }

      return fetch(event.request).then((response) => {
        if (!response || response.status !== 200 || response.type === 'error') {
          return response;
        }

        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });

        return response;
      }).catch(() => {
        // Return offline page as last resort
        return caches.match('/offline.html');
      });
    })
  );
});

// Handle messages from clients
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Periodic cache cleanup - remove stale API responses
setInterval(() => {
  caches.open(RUNTIME_CACHE).then((cache) => {
    cache.keys().then((requests) => {
      requests.forEach((request) => {
        cache.match(request).then((response) => {
          if (response && response.headers.get('date')) {
            const responseDate = new Date(response.headers.get('date')).getTime();
            if (Date.now() - responseDate > 3600000) { // 1 hour
              cache.delete(request);
            }
          }
        });
      });
    });
  });
}, 3600000); // Run every hour
