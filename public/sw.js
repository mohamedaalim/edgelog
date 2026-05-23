const CACHE = "edgelog-v2";
const PRECACHE = ["/", "/dashboard", "/journal", "/analytics", "/manifest.json"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);

  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/_next/")) {
    e.respondWith(fetch(e.request));
    return;
  }

  if (e.request.mode === "navigate") {
    e.respondWith(
      fetch(e.request).catch(() => caches.match("/"))
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then((cached) => cached ?? fetch(e.request))
  );
});

// ── Push notification handler ─────────────────────────────────────────────────
self.addEventListener("push", (e) => {
  if (!e.data) return;

  let data = {};
  try { data = e.data.json(); } catch { data = { title: "EdgeLog", body: e.data.text() }; }

  const { title = "EdgeLog", body = "", icon = "/icons/icon-192.png", badge = "/icons/icon-192.png", url = "/dashboard", tag } = data;

  e.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon,
      badge,
      tag,
      data: { url },
      requireInteraction: false,
      vibrate: [100, 50, 100],
    })
  );
});

// ── Notification click — open the linked page ─────────────────────────────────
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const targetUrl = e.notification.data?.url ?? "/dashboard";

  e.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      // Focus existing tab if already open
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      // Open new tab
      if (clients.openWindow) return clients.openWindow(targetUrl);
    })
  );
});
