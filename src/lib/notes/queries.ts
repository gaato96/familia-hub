import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, NoteRow } from "@/types/database";

export type Note = NoteRow;

/**
 * Las notas visibles del tablero.
 *
 * El filtro de vencidas va acá y no en una policy de RLS: una nota vencida no
 * es un problema de permisos, y meterla en la policy la volvería invisible
 * también para el que quisiera revivirla o para un backup.
 *
 * Sin filtro por family_id: lo pone RLS. Si esta query devolviera notas de otra
 * casa, el problema estaría en las policies, no acá.
 */
export async function fetchNotes(
  supabase: SupabaseClient<Database>,
): Promise<Note[]> {
  const { data, error } = await supabase
    .from("notes")
    .select("*")
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
    .order("is_pinned", { ascending: false })
    .order("position", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

/** Inclinación estable derivada del id, para que la nota no salte al re-render. */
export function rotationFor(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  // Entre -2.5 y 2.5 grados: suficiente para que se lea como papel pegado a
  // mano, poco para que el texto siga cómodo.
  return ((Math.abs(hash) % 51) - 25) / 10;
}

export const NOTE_COLORS = {
  yellow: { bg: "#FEF3A8", ink: "#4A3F09", label: "Amarillo" },
  pink: { bg: "#FBC9DD", ink: "#4E1029", label: "Rosa" },
  blue: { bg: "#BFDDF7", ink: "#0C2E4A", label: "Azul" },
  green: { bg: "#C4EBC0", ink: "#153A17", label: "Verde" },
  orange: { bg: "#FCD5A8", ink: "#4A2C06", label: "Naranja" },
  purple: { bg: "#DDD0FA", ink: "#2C1A50", label: "Violeta" },
} as const;
