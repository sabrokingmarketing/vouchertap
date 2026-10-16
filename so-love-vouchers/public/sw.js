// Minimal push notification service worker for So Love Krugersdorp
// Handles push delivery, click-through, and installability. No caching.

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Chromium only offers an install prompt (beforeinstallprompt) for a service
// worker that has a fetch handler. This one is deliberately inert: it never
// calls respondWith, so every request falls through to the network exactly as
// before. Installability only — this is still not an offline-capable app.
self.addEventListener("fetch", () => {});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (e) {
    payload = { title: "So Love Krugersdorp", body: event.data ? event.data.text() : "" };
  }

  const title = payload.title || "So Love Krugersdorp";
  const options = {
    body: payload.body || "",
    icon: payload.icon || "/icon-192.png",
    badge: payload.badge || "/icon-192.png",
    image: payload.image || undefined,
    tag: payload.tag || undefined,
    data: { url: payload.url || "/app" },
    vibrate: [120, 60, 120],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/app";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        try {
          const url = new URL(client.url);
          if (url.origin === self.location.origin && "focus" in client) {
            client.navigate(target);
            return client.focus();
          }
        } catch (e) {}
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
    }),
  );
});
