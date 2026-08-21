"use client";

import { minutesNowAr } from "@/lib/agenda/blocks";

/**
 * La hora actual como store externo.
 *
 * La línea de "ahora" tiene que moverse sola: una app que dice "ahora" en un
 * lugar equivocado porque la pestaña quedó abierta desde la mañana es peor que
 * una que no lo dice. Pero un `setInterval` que llame a `setState` dentro de un
 * efecto es exactamente lo que prohíbe `react-hooks/set-state-in-effect`, y con
 * razón: obliga a un render extra en la hidratación.
 *
 * `useSyncExternalStore` sobre esto lo resuelve: el snapshot del servidor lo
 * pasa la pantalla (el mismo valor con el que renderizó), así que el HTML del
 * servidor y el primer render del cliente coinciden y recién después empieza a
 * latir.
 *
 * Late cada 30 segundos y no cada segundo: lo más chico que se dibuja es un
 * minuto.
 */
const TICK_MS = 30_000;

let current = minutesNowAr();
let timer: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<() => void>();

function tick() {
  const next = minutesNowAr();
  if (next === current) return;
  current = next;
  for (const listener of listeners) listener();
}

export function subscribeToNow(listener: () => void): () => void {
  listeners.add(listener);
  if (timer === null) timer = setInterval(tick, TICK_MS);

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  };
}

export function getNowMinutes(): number {
  return current;
}
