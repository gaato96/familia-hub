import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { NetworkFirst, NetworkOnly, Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const OFFLINE_URL = "/offline";

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    /* ------------------------------------------------------------------
       NUNCA SE CACHEA.

       Una tarea, una nota o un ítem de la compra cacheados son peor que no
       tener nada: hacen que dos personas vean estados distintos y compren la
       misma cosa dos veces. Todo lo que sea datos va siempre a la red.
    ------------------------------------------------------------------ */
    {
      matcher: ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith("/api/"),
      handler: new NetworkOnly(),
    },
    {
      // Supabase REST / Realtime / Auth — siempre en vivo.
      matcher: ({ url }) => url.hostname.endsWith(".supabase.co"),
      handler: new NetworkOnly(),
    },

    /* ------------------------------------------------------------------
       LA EXCEPCIÓN: /emergencia.

       Es la única pantalla con datos que se cachea, y el motivo es el que
       justifica romper la regla de arriba: tiene que abrir en una guardia
       sin señal. Va NetworkFirst con 3s de espera, así que con internet
       siempre muestra lo actual y solo cae al cache cuando no hay red.

       Los datos en sí los guarda el componente en localStorage (ver
       emergency-card.tsx) — esto cachea el HTML que los pinta.
    ------------------------------------------------------------------ */
    {
      matcher: ({ url, sameOrigin, request }) =>
        sameOrigin && request.mode === "navigate" && url.pathname === "/emergencia",
      handler: new NetworkFirst({
        cacheName: "ficha-emergencia",
        networkTimeoutSeconds: 3,
        plugins: [
          {
            cacheWillUpdate: async ({ response }) =>
              response.status === 200 ? response : null,
          },
        ],
      }),
    },

    ...defaultCache,
  ],
  fallbacks: {
    entries: [
      {
        url: OFFLINE_URL,
        matcher: ({ request }) => request.destination === "document",
      },
    ],
  },
});

/* ---------------------------------------------------------------------------
   Web Push.

   Es lo que hace que "te asigné sacar la basura" llegue con la app cerrada y
   el teléfono en el bolsillo. En iPhone solo funciona con la PWA instalada en
   la pantalla de inicio: es un límite de Apple, no del código.
--------------------------------------------------------------------------- */
type PushPayload = {
  title?: string;
  body?: string;
  url?: string;
  tag?: string;
};

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload: PushPayload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "Casa", body: event.data.text() };
  }

  event.waitUntil(
    self.registration.showNotification(payload.title ?? "Casa", {
      body: payload.body ?? "",
      icon: "/icons/icon-192.png",
      badge: "/icons/badge-72.png",
      // Un tag por tipo de aviso: cinco tareas asignadas se apilan en una sola
      // tarjeta en vez de tapar la pantalla de bloqueo.
      tag: payload.tag ?? "casa",
      renotify: true,
      vibrate: [200, 80, 200],
      data: { url: payload.url ?? "/" },
    } as NotificationOptions),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data?.url as string | undefined) ?? "/";

  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      // Reusar la ventana abierta en vez de apilar una nueva cada vez.
      for (const client of clients) {
        if (new URL(client.url).origin === self.location.origin) {
          await client.focus();
          if ("navigate" in client) await client.navigate(target);
          return;
        }
      }

      await self.clients.openWindow(target);
    })(),
  );
});

serwist.addEventListeners();
