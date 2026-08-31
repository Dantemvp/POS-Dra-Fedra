// Service Worker — Sistema Dra. Fedra Aldama
// Recibe notificaciones push y las muestra en el dispositivo (cel/laptop),
// aunque la app esté cerrada. NO hace caché offline (eso es otro alcance).

self.addEventListener("install", () => {
  // Activa esta versión de inmediato sin esperar a que se cierren las pestañas.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // Toma control de las páginas abiertas al instante.
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", function (event) {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Sistema Fedra", body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "Sistema Fedra";
  const options = {
    body: data.body || "",
    icon: data.icon || "/icon-192.png",
    badge: "/badge.png",
    vibrate: [120, 60, 120],
    tag: data.tag || undefined, // notificaciones con mismo tag se reemplazan
    renotify: !!data.tag,
    requireInteraction: !!data.requireInteraction,
    data: {
      url: data.url || "/dashboard",
      arrivedAt: Date.now(),
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  const destino = (event.notification.data && event.notification.data.url) || "/dashboard";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // Si ya hay una ventana abierta de la app, enfócala y navega.
        for (const client of clientList) {
          if ("focus" in client) {
            client.focus();
            if ("navigate" in client) client.navigate(destino);
            return;
          }
        }
        // Si no, abre una nueva.
        if (self.clients.openWindow) return self.clients.openWindow(destino);
      }),
  );
});
