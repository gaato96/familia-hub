import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { NetworkOnly, Serwist } from "serwist";

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
