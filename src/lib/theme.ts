"use client";

/**
 * Store externo del tema.
 *
 * El tema vive en el `<html>` (lo aplica ThemeScript antes del primer pintado)
 * y en localStorage, no en estado de React. Leerlo con un `useEffect` que
 * llame a setState encadena un render extra y además hace parpadear el ícono
 * en la primera pintura; `useSyncExternalStore` lee la fuente real y se
 * suscribe a los cambios, que es exactamente para lo que existe.
 */

type Listener = () => void;

const listeners = new Set<Listener>();

/** Cacheado: `getSnapshot` tiene que devolver el MISMO valor si nada cambió, o React entra en loop. */
let snapshot = false;

function read(): boolean {
  return document.documentElement.classList.contains("dark");
}

export function subscribeTheme(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getThemeSnapshot(): boolean {
  const current = read();
  if (current !== snapshot) snapshot = current;
  return snapshot;
}

/** En el server no hay DOM; se asume claro y el script corrige antes de pintar. */
export function getThemeServerSnapshot(): boolean {
  return false;
}

export function setDarkMode(dark: boolean): void {
  document.documentElement.classList.toggle("dark", dark);
  try {
    // Se guarda la elección EXPLÍCITA: si alguien eligió claro de día, el modo
    // oscuro del sistema no se lo tiene que pisar a la noche.
    localStorage.setItem("casa-theme", dark ? "dark" : "light");
  } catch {
    // localStorage bloqueado: el tema vale para esta sesión y nada más.
  }
  snapshot = dark;
  for (const listener of listeners) listener();
}
