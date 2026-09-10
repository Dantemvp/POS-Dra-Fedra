// Service Worker — Sistema Dra. Fedra Aldama
// Recibe notificaciones push y las muestra en el dispositivo (cel/laptop),
// aunque la app esté cerrada. La caché se limita a recursos públicos y
// compilados; nunca guarda páginas, APIs ni respuestas con datos clínicos.

const CACHE_NAME = "fedra-static-v0.1.15";
const PRECACHE = [
  "/logo.png",
  "/icon-192.png",
  "/icon-512.png",
  "/badge.png",
  "/manifest.webmanifest",
];

self.addEventListener("install", (event) => {
  // Activa esta versión de inmediato sin esperar a que se cierren las pestañas.
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.allSettled(PRECACHE.map((recurso) => cache.add(recurso))),
    ),
  );
});

self.addEventListener("activate", (event) => {
  // Toma control de las páginas abiertas al instante.
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches
        .keys()
        .then((nombres) =>
          Promise.all(
            nombres
              .filter((nombre) => nombre.startsWith("fedra-static-") && nombre !== CACHE_NAME)
              .map((nombre) => caches.delete(nombre)),
          ),
        ),
    ]),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  const esRecursoEstatico =
    PRECACHE.includes(url.pathname) ||
    url.pathname.startsWith("/_next/static/") ||
    url.pathname === "/_next/image";
  if (!esRecursoEstatico) return;

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const guardado = await cache.match(request);
      if (guardado) return guardado;

      const respuesta = await fetch(request);
      if (respuesta.ok) await cache.put(request, respuesta.clone());
      return respuesta;
    }),
  );
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
