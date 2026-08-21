"use client";

/**
 * Instalar la app en el teléfono.
 *
 * El navegador dispara `beforeinstallprompt` **una sola vez y temprano** —a
 * veces antes de que React hidrate— y si nadie lo agarra, se pierde para
 * siempre en esa visita. Por eso el listener se engancha al evaluar el módulo
 * y no adentro de un efecto: cuando el componente se monta ya puede ser tarde.
 *
 * Después hay tres mundos distintos y hay que decirlos distinto:
 *
 * - **Android / Chrome de escritorio**: hay evento, así que hay botón real.
 * - **iPhone**: Apple no expone ningún evento. La única forma es Compartir →
 *   "Agregar a inicio", y hay que explicarlo con palabras. Además es la única
 *   forma de que funcionen los avisos push.
 * - **Ya instalada**: no hay nada que ofrecer.
 */

export type InstallState =
  | { status: "installed" }
  | { status: "available" }
  | { status: "ios-manual" }
  | { status: "unavailable" };

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

let deferred: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();

/** `useSyncExternalStore` exige que el snapshot sea estable entre renders:
 *  devolver un objeto nuevo cada vez lo manda a un loop infinito. */
let snapshot: InstallState = { status: "unavailable" };

const SERVER_SNAPSHOT: InstallState = { status: "unavailable" };

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // Safari en iOS no soporta display-mode: standalone y usa esta propiedad.
    (window.navigator as { standalone?: boolean }).standalone === true
  );
}

function isIos(): boolean {
  const ua = window.navigator.userAgent;
  // El iPad moderno se hace pasar por Mac; el `maxTouchPoints` lo delata.
  return (
    /iphone|ipad|ipod/i.test(ua) ||
    (/macintosh/i.test(ua) && window.navigator.maxTouchPoints > 1)
  );
}

function compute(): InstallState {
  if (typeof window === "undefined") return SERVER_SNAPSHOT;
  if (isStandalone()) return { status: "installed" };
  if (deferred) return { status: "available" };
  if (isIos()) return { status: "ios-manual" };
  return { status: "unavailable" };
}

function publish() {
  const next = compute();
  if (next.status === snapshot.status) return;
  snapshot = next;
  for (const listener of listeners) listener();
}

if (typeof window !== "undefined") {
  snapshot = compute();

  window.addEventListener("beforeinstallprompt", (event) => {
    // Sin esto, Chrome muestra su propia barra de instalación además de la
    // nuestra y quedan dos ofertas de lo mismo en la misma pantalla.
    event.preventDefault();
    deferred = event as InstallPromptEvent;
    publish();
  });

  window.addEventListener("appinstalled", () => {
    deferred = null;
    publish();
  });
}

export function subscribeToInstall(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getInstallState(): InstallState {
  return snapshot;
}

export function getInstallServerState(): InstallState {
  return SERVER_SNAPSHOT;
}

/**
 * Abre el diálogo nativo. Devuelve si la persona aceptó.
 *
 * El evento se consume: el navegador no lo vuelve a disparar en esta visita,
 * así que después de usarlo se descarta y el estado pasa a "unavailable" —
 * ofrecer un botón que ya no hace nada es peor que no ofrecerlo.
 */
export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false;

  const event = deferred;
  deferred = null;

  await event.prompt();
  const { outcome } = await event.userChoice;
  publish();

  return outcome === "accepted";
}
