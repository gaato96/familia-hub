import type { MetadataRoute } from "next";

import { APP_DESCRIPTION, APP_NAME } from "@/lib/brand";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${APP_NAME} — la casa en orden`,
    short_name: APP_NAME,
    description: APP_DESCRIPTION,
    start_url: "/",
    display: "standalone",
    // Sin `orientation: portrait`: ahora la app también se usa en una pantalla
    // grande, y forzar vertical rompe la tablet apoyada de costado.
    background_color: "#f7f9fd",
    theme_color: "#f7f9fd",
    lang: "es-AR",
    dir: "ltr",
    categories: ["productivity", "lifestyle"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icons/maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    // Atajos del ícono en la pantalla de inicio: mantener apretado y saltar
    // directo a lo que se abre veinte veces por día.
    shortcuts: [
      {
        name: "Ver el día",
        short_name: "Hoy",
        url: "/dia",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Lista del súper",
        short_name: "Compras",
        url: "/compras",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Ficha de emergencia",
        short_name: "Emergencia",
        url: "/emergencia",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
    ],
  };
}
