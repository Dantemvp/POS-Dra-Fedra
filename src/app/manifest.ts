import type { MetadataRoute } from "next";

// Manifiesto PWA. Permite "Agregar a pantalla de inicio" en el cel de la Dra.,
// requisito para recibir notificaciones push en iOS 16.4+.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Sistema Dra. Fedra Aldama",
    short_name: "Fedra",
    description: "Farmacia y consultorio — punto de venta, inventario y agenda",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#1c1917",
    lang: "es-MX",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
