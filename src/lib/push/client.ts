"use client";

/**
 * Alta del dispositivo para Web Push.
 *
 * En iPhone esto SOLO funciona con la PWA instalada en la pantalla de inicio.
 * Es un límite de Apple, no del código: en Safari normal, `Notification` ni
 * siquiera existe. Por eso `pushSupport()` distingue "no se puede" de "hay que
 * instalarla primero" — sin ese matiz, el usuario toca el botón, no pasa nada,
 * y concluye que la app está rota.
 */

export type PushSupport =
  | { status: "ready" }
  | { status: "needs-install" }
  | { status: "unsupported" }
  | { status: "denied" };

export function pushSupport(): PushSupport {
  if (typeof window === "undefined") return { status: "unsupported" };

  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    // Safari en iOS no soporta display-mode: standalone y usa esta propiedad.
    (window.navigator as { standalone?: boolean }).standalone === true;

  const isIos = /iphone|ipad|ipod/i.test(window.navigator.userAgent);

  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return isIos && !isStandalone ? { status: "needs-install" } : { status: "unsupported" };
  }

  if (Notification.permission === "denied") return { status: "denied" };
  if (isIos && !isStandalone) return { status: "needs-install" };

  return { status: "ready" };
}

export async function subscribeToPush(): Promise<boolean> {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return false;

  const registration = await navigator.serviceWorker.ready;

  // Si ya había una suscripción de un build anterior, se reusa: pedir una nueva
  // deja endpoints huérfanos a los que se seguiría empujando para siempre.
  const existing = await registration.pushManager.getSubscription();
  const subscription =
    existing ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(
        process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
      ),
    }));

  const response = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(subscription.toJSON()),
  });

  return response.ok;
}

export async function unsubscribeFromPush(): Promise<void> {
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;

  await fetch("/api/push/subscribe", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint: subscription.endpoint }),
  });

  await subscription.unsubscribe();
}

export async function isSubscribed(): Promise<boolean> {
  if (!("serviceWorker" in navigator)) return false;
  const registration = await navigator.serviceWorker.ready;
  return (await registration.pushManager.getSubscription()) !== null;
}

/**
 * La clave VAPID viaja en base64url y `subscribe()` pide bytes crudos.
 *
 * El ArrayBuffer se crea explícito en vez de usar `Uint8Array.from`: desde
 * TypeScript 5.7 los typed arrays llevan el tipo del buffer, y el genérico que
 * infiere `from` (`ArrayBufferLike`, que incluye SharedArrayBuffer) no encaja
 * en el `BufferSource` que espera la API.
 */
function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(normalized);

  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) {
    bytes[i] = raw.charCodeAt(i);
  }
  return bytes;
}
