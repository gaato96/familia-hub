import type { SupabaseClient } from "@supabase/supabase-js";

import { sortGoals, type GoalWithSteps } from "@/lib/goals/progress";
import type { Database } from "@/types/database";

/**
 * Los objetivos con sus pasos, en una sola ida.
 *
 * Embebido y no dos queries con un `map` después: son pocas filas y el join lo
 * hace PostgREST. Traerlos por separado obligaría a decidir qué hacer cuando
 * llega un paso de un objetivo que la otra query no devolvió.
 */
export async function fetchGoals(
  supabase: SupabaseClient<Database>,
): Promise<GoalWithSteps[]> {
  const { data, error } = await supabase
    .from("goals")
    .select("*, steps:goal_steps(*)")
    .neq("status", "archivado")
    .order("position", { ascending: true });

  if (error) throw error;

  const goals = (data ?? []).map((goal) => ({
    ...goal,
    // El orden de los pasos no se puede pedir dentro del embebido junto con el
    // del padre, así que se ordena acá.
    steps: [...goal.steps].sort((a, b) => a.position - b.position),
  })) as GoalWithSteps[];

  return sortGoals(goals);
}
