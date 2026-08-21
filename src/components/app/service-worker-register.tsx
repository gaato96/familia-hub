"use client";

import { useEffect } from "react";

// Import por su efecto de módulo, a propósito: engancha el listener de
// `beforeinstallprompt`. El navegador dispara ese evento UNA sola vez y
// temprano, así que tiene que haber alguien escuchando en todas las pantallas
// —no solo en Ajustes, que es donde se muestra el botón—. Este componente vive
// en el layout raíz, que es el único lugar que cumple eso.
import "@/lib/pwa/install";

/**
 * Registra el service worker.
 *
 * `@serwist/next` genera /sw.js en el build pero NO lo registra solo cuando la
 * app usa App Router sin su componente propio. Sin esto la PWA se instala
 * igual, pero no hay caché offline ni push: el síntoma es que todo "anda" y
 * las notificaciones nunca llegan.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return;

    void navigator.serviceWorker.register("/sw.js", { scope: "/" });
  }, []);

  return null;
}
