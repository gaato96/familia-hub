import withSerwistInit from "@serwist/next";
import type { NextConfig } from "next";

/**
 * Los adjuntos del expediente viven en buckets PRIVADOS de Supabase y se sirven
 * siempre por URL firmada, nunca por URL pública. El hostname depende del
 * entorno, así que sale de la URL pública en vez de estar hardcodeado.
 */
const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : undefined;

const nextConfig: NextConfig = {
  images: {
    remotePatterns: supabaseHost
      ? [{ protocol: "https", hostname: supabaseHost, pathname: "/storage/v1/object/sign/**" }]
      : [],
    // Los tamaños que realmente se piden: avatar en la nav, chip de integrante,
    // miniatura de documento en la grilla y la vista ampliada.
    imageSizes: [32, 48, 96, 128, 256, 384],
    deviceSizes: [640, 750, 828, 1080, 1200],
  },
  async headers() {
    return [
      {
        // El service worker nunca puede servirse cacheado, o un teléfono queda
        // clavado en un build viejo mientras dure la caché.
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  // Un service worker en dev te devuelve tus propias ediciones cacheadas.
  disable: process.env.NODE_ENV === "development",
  reloadOnOnline: false,
});

export default withSerwist(nextConfig);
