import { WeekView } from "@/components/planner/week-view";
import { minutesNowAr } from "@/lib/agenda/blocks";
import { fetchTimeBlocks } from "@/lib/agenda/queries";
import { requireFamily } from "@/lib/auth/context";
import { addDaysIso, startOfWeekAr, todayInAr, type IsoDate } from "@/lib/dates";
import {
  ensureInstances,
  fetchEventsBetween,
  fetchTasksBetween,
} from "@/lib/planner/queries";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "La semana" };

/**
 * Planner semanal. La semana arranca el lunes y se elige por la URL
 * (`?semana=YYYY-MM-DD`), no por estado de cliente: así "mandale el link de la
 * semana que viene" funciona, y volver atrás con el gesto del teléfono vuelve
 * a la semana anterior en lugar de salir de la pantalla.
 */
export default async function PlannerPage({
  searchParams,
}: {
  searchParams: Promise<{ semana?: string; quien?: string }>;
}) {
  const { semana, quien } = await searchParams;
  const { members, member } = await requireFamily();

  const today = todayInAr();
  const monday = startOfWeekAr(isIsoDate(semana) ? semana : today);
  const sunday = addDaysIso(monday, 6);

  const supabase = await createClient();

  // Generar antes de leer: mirar una semana futura por primera vez tiene que
  // mostrar las tareas recurrentes que todavía no se habían materializado.
  await ensureInstances(supabase, sunday);

  const [tasks, events, blocks] = await Promise.all([
    fetchTasksBetween(supabase, monday, sunday),
    fetchEventsBetween(supabase, monday, sunday),
    fetchTimeBlocks(supabase, monday, sunday),
  ]);

  return (
    <WeekView
      monday={monday}
      today={today}
      tasks={tasks}
      events={events}
      members={members}
      blocks={blocks}
      currentMemberId={member.id}
      filterMemberId={quien ?? null}
      serverNowMinutes={minutesNowAr()}
    />
  );
}

function isIsoDate(value: string | undefined): value is IsoDate {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}
