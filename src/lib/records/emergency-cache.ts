"use client";

import type { ContactRow, EmergencyCardRow } from "@/types/database";

/**
 * Copia local de la ficha de emergencia.
 *
 * Existe para un solo escenario, que es el que justifica todo el módulo: estar
 * en una guardia, sin señal, teniendo que decir el grupo sanguíneo y las
 * alergias. Una ficha médica que necesita internet para abrirse es una ficha
 * que no está cuando hace falta.
 *
 * Se expone como store externo (`useSyncExternalStore`) y no como estado leído
 * en un `useEffect`: leer localStorage con setState dentro de un efecto encadena
 * un render extra y, peor, hace que la pantalla parpadee vacía antes de
 * mostrar los datos.
 */

export type CachedCard = {
  savedAt: string;
  members: EmergencyCardRow[];
  contacts: ContactRow[];
};

const KEY = "casa-ficha-emergencia";

type Listener = () => void;
const listeners = new Set<Listener>();

/**
 * `getSnapshot` tiene que devolver el MISMO objeto mientras nada cambie, o
 * React entra en un loop infinito de renders. Por eso se cachea el parseo y se
 * invalida solo al guardar.
 */
let snapshot: CachedCard | null = null;
let parsed = false;

export function subscribeCard(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getCardSnapshot(): CachedCard | null {
  if (!parsed) {
    try {
      const raw = localStorage.getItem(KEY);
      snapshot = raw ? (JSON.parse(raw) as CachedCard) : null;
    } catch {
      // localStorage bloqueado o JSON corrupto: sin copia local, nada más.
      snapshot = null;
    }
    parsed = true;
  }
  return snapshot;
}

/** En el server no hay localStorage; la copia local aparece al hidratar. */
export function getCardServerSnapshot(): CachedCard | null {
  return null;
}

export function saveCard(card: CachedCard): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(card));
  } catch {
    // Sin espacio o en modo privado: la ficha sigue andando con internet.
    return;
  }
  snapshot = card;
  parsed = true;
  for (const listener of listeners) listener();
}
