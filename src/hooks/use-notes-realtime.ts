"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { fetchNotes, type Note } from "@/lib/notes/queries";
import { createClient } from "@/lib/supabase/client";

/**
 * Notas del tablero, con TRES fuentes de actualización deliberadamente
 * redundantes. Leer esto antes de "simplificarlo" a solo Realtime:
 *
 *   1. Supabase Realtime — lo instantáneo. Es lo que hace que una nota escrita
 *      en la cocina aparezca en el teléfono del living en el mismo segundo.
 *   2. Poll cada 30s — una red móvil mata sockets en silencio, sobre todo
 *      cuando el teléfono se duerme. Sin esto, el tablero queda congelado sin
 *      que nada avise.
 *   3. Refetch al recuperar el foco — el caso más común de todos: el teléfono
 *      estuvo en el bolsillo dos horas y se desbloquea. Ahí lo primero que se
 *      ve tiene que ser lo de ahora, no lo de hace dos horas.
 *
 * Cada una tapa un agujero que las otras dos no ven. Con una sola, el tablero
 * miente y nadie se entera.
 */
const POLL_INTERVAL_MS = 30_000;

export function useNotesRealtime(initialNotes: Note[]) {
  const [notes, setNotes] = useState<Note[]>(initialNotes);
  const supabaseRef = useRef(createClient());

  const refetch = useCallback(async () => {
    try {
      setNotes(await fetchNotes(supabaseRef.current));
    } catch {
      // Un refetch que falla no puede vaciar el tablero: se queda con lo
      // último bueno y la próxima pasada lo corrige.
    }
  }, []);

  useEffect(() => {
    const supabase = supabaseRef.current;

    // 1. Realtime. Se refetchea en vez de aplicar el payload fila por fila:
    // el orden depende de is_pinned y position, así que reconstruirlo a mano
    // en el cliente sería duplicar la lógica de la query del servidor.
    const channel = supabase
      .channel("notes-board")
      .on("postgres_changes", { event: "*", schema: "public", table: "notes" }, () => {
        void refetch();
      })
      .subscribe();

    // 2. Poll.
    const timer = setInterval(() => void refetch(), POLL_INTERVAL_MS);

    // 3. Foco y vuelta de la pantalla.
    const onFocus = () => void refetch();
    const onVisible = () => {
      if (document.visibilityState === "visible") void refetch();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      void supabase.removeChannel(channel);
      clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refetch]);

  return { notes, setNotes, refetch };
}
