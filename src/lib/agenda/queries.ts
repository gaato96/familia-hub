import type { SupabaseClient } from "@supabase/supabase-js";

import type { IsoDate } from "@/lib/dates";
import type { Database, TimeBlockRow } from "@/types/database";

/**
 * Los bloques que pueden aplicar al rango: todos los recurrentes más los
 * puntuales de esas fechas.
 *
 * Los recurrentes se traen enteros y sin filtrar por día de semana. Una casa
 * tiene treinta bloques en total; filtrarlos en SQL por `weekdays &&
 * array[...]` ahorraría unas pocas filas y obligaría a repetir en Postgres la
 * regla de vigencia que ya vive en `blockAppliesOn()`. Dos copias de una regla
 * es cómo se rompen estas cosas.
 */
export async function fetchTimeBlocks(
  supabase: SupabaseClient<Database>,
  from: IsoDate,
  to: IsoDate,
): Promise<TimeBlockRow[]> {
  const { data, error } = await supabase
    .from("time_blocks")
    .select("*")
    .or(`on_date.is.null,and(on_date.gte.${from},on_date.lte.${to})`)
    .order("starts_at", { ascending: true });

  if (error) throw error;
  return data ?? [];
}
