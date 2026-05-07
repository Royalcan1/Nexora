// ==========================================
//  NEXORA SERVICE WORKER
//  Stratégie : network-first (toujours frais quand online)
// ==========================================

const CACHE_NAME = "nexora-v4";
const SHELL = [
  "/", "/index.html", "/style.css", "/script.js", "/manifest.json",
  "/icon-192.png", "/icon-512.png", "/icon-192-maskable.png", "/icon-512-maskable.png",
  "/apple-touch-icon.png", "/favicon.png",
  "/screenshot-mobile.png", "/screenshot-desktop.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((c) => c.addAll(SHELL)));
  // Pas de skipWaiting auto : on attend que l'utilisateur clique sur "Mettre à jour"
});

// Le client peut nous demander de prendre le contrôle immédiatement
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.hostname.includes("supabase.co")) return;
  if (url.origin !== self.location.origin) return;

  // Network-first : essayer réseau, fallback cache si offline
  event.respondWith(
    fetch(req)
      .then((response) => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, clone));
        }
        return response;
      })
      .catch(() =>
        caches.match(req).then((cached) =>
          cached || (req.destination === "document" ? caches.match("/index.html") : undefined)
        )
      )
  );
});

// 🔔 Click sur une notification → ouvrir/focus l'app
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if (c.url.startsWith(self.registration.scope) && "focus" in c) return c.focus();
      }
      if (clients.openWindow) return clients.openWindow("/");
    })
  );
});
