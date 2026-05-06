// ==========================================
//  NEXORA SERVICE WORKER
//  Stratégie : cache shell + network-first dynamique
// ==========================================

const CACHE_NAME = "nexora-v2";
const SHELL = [
  "/",
  "/index.html",
  "/style.css",
  "/script.js",
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png",
  "/icon-192-maskable.png",
  "/icon-512-maskable.png",
  "/apple-touch-icon.png",
  "/favicon.png"
];

// Install : mise en cache du shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL))
  );
  self.skipWaiting();
});

// Activate : nettoyage des anciens caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch : on intercepte uniquement les GET vers notre origine
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Ne PAS intercepter les requêtes Supabase (besoin de fraîcheur)
  if (url.hostname.includes("supabase.co")) return;

  // Ne PAS intercepter les CDN externes
  if (url.origin !== self.location.origin) return;

  // Stratégie : cache-first pour le shell, network-then-cache pour le reste
  event.respondWith(
    caches.match(req).then((cached) => {
      const networkFetch = fetch(req)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return response;
        })
        .catch(() => {
          if (req.destination === "document") {
            return caches.match("/index.html");
          }
        });
      return cached || networkFetch;
    })
  );
});
