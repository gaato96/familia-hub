import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Casa — organización familiar",
    short_name: "Casa",
    description: "Tareas, planner, compras y expediente de la familia.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#faf8f5",
    theme_color: "#faf8f5",
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
        name: "Pegar una nota",
        short_name: "Nota",
        url: "/?nota=nueva",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Lista del súper",
        short_name: "Compras",
        url: "/compras",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "La semana",
        short_name: "Planner",
        url: "/planner",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
      // El atajo a /emergencia se agrega en la Fase 2, cuando esa pantalla
      // exista: un shortcut a un 404 es peor que no tener el shortcut.
    ],
  };
}
