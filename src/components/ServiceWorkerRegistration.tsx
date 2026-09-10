"use client";

import { useEffect } from "react";
import { SERVICE_WORKER_URL } from "@/lib/version";

export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker
      .register(SERVICE_WORKER_URL, { scope: "/", updateViaCache: "none" })
      .catch(() => {
        // La aplicación sigue funcionando en navegadores sin service worker.
      });
  }, []);

  return null;
}
