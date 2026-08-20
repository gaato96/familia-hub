import type { SupabaseClient } from "@supabase/supabase-js";

import { endOfDayAr, startOfDayAr, type IsoDate } from "@/lib/dates";
import type { Database, EventRow, TaskInstanceRow, TaskRow } from "@/types/database";

/** Una ocurrencia con los datos de su plantilla: lo que la UI necesita para pintar una fila. */
export type PlannerTask = TaskInstanceRow & {
  task: Pick<TaskRow, "title" | "category" | "priority" | "notes"> | null;
};

/**
 * Materializa las ocurrencias que falten hasta `until`.
 *
 * Se llama en cada carga del planner: `ensure_task_instances()` es idempotente
 * (el unique (task_id, due_date) absorbe lo ya generado), así que llamarla de
 * más no cuesta filas. La alternativa —generar solo desde un cron— dejaría el
 * planner vacío la primera vez que alguien mira una semana futura.
 */
export async function ensureInstances(
  supabase: SupabaseClient<Database>,
  until: IsoDate,
): Promise<void> {
  const { error } = await supabase.rpc("ensure_task_instances", { p_until: until });
  // Un fallo acá no puede tumbar la pantalla: en el peor caso se ve la semana
  // con lo que ya estaba generado.
  if (error) console.error("ensure_task_instances", error.message);
}

export async function fetchTasksBetween(
  supabase: SupabaseClient<Database>,
  from: IsoDate,
  to: IsoDate,
): Promise<PlannerTask[]> {
  const { data, error } = await supabase
    .from("task_instances")
    .select("*, task:tasks(title, category, priority, notes)")
    .gte("due_date", from)
    .lte("due_date", to)
    .order("due_date", { ascending: true });

  if (error) throw error;
  return (data ?? []) as PlannerTask[];
}

export async function fetchEventsBetween(
  supabase: SupabaseClient<Database>,
  from: IsoDate,
  to: IsoDate,
): Promise<EventRow[]> {
  const { data, error } = await supabase
    .from("events")
    .select("*")
    // Los eventos son timestamptz y las fechas del planner son días
    // argentinos: el rango se arma con los bordes del día en -03, no en UTC,
    // o un evento de las 22:00 aparecería al día siguiente.
    .gte("starts_at", startOfDayAr(from).toISOString())
    .lte("starts_at", endOfDayAr(to).toISOString())
    .order("starts_at", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

/** Tareas vencidas sin completar: lo que el resumen del día muestra en rojo. */
export async function fetchOverdueTasks(
  supabase: SupabaseClient<Database>,
  today: IsoDate,
): Promise<PlannerTask[]> {
  const { data, error } = await supabase
    .from("task_instances")
    .select("*, task:tasks(title, category, priority, notes)")
    .lt("due_date", today)
    .eq("status", "pending")
    .order("due_date", { ascending: true })
    .limit(20);

  if (error) throw error;
  return (data ?? []) as PlannerTask[];
}
