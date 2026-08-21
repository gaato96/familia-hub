import { DayView } from "@/components/agenda/day-view";
import { PageHeader } from "@/components/ui/page-header";
import { minutesNowAr } from "@/lib/agenda/blocks";
import { fetchTimeBlocks } from "@/lib/agenda/queries";
import { requireFamily } from "@/lib/auth/context";
import { formatLongDate, todayInAr, type IsoDate } from "@/lib/dates";
import { ensureInstances, fetchEventsBetween, fetchTasksBetween } from "@/lib/planner/queries";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Hoy" };

/**
 * La vista diaria.
 *
 * Igual que el planner, el día se elige por la URL (`?fecha=YYYY-MM-DD`) y no
 * por estado de cliente: el gesto de "atrás" del teléfono vuelve al día
 * anterior en vez de salir de la pantalla, y el link se puede mandar.
 */
export default async function DiaPage({
  searchParams,
}: {
  searchParams: Promise<{ fecha?: string }>;
}) {
  const { fecha } = await searchParams;
  const { members } = await requireFamily();

  const today = todayInAr();
  const date = isIsoDate(fecha) ? fecha : today;

  const supabase = await createClient();

  // Igual que en el planner: mirar un día futuro por primera vez tiene que
  // mostrar las tareas recurrentes que todavía no se materializaron.
  await ensureInstances(supabase, date);

  const [blocks, events, tasks] = await Promise.all([
    fetchTimeBlocks(supabase, date, date),
    fetchEventsBetween(supabase, date, date),
    fetchTasksBetween(supabase, date, date),
  ]);

  return (
    <>
      <PageHeader
        title={date === today ? "Hoy" : capitalize(formatLongDate(date))}
        subtitle={date === today ? capitalize(formatLongDate(date)) : undefined}
      />
      <DayView
        date={date}
        today={today}
        blocks={blocks}
        events={events}
        tasks={tasks}
        members={members}
        // La hora se calcula en el servidor y se pasa como snapshot inicial:
        // el cliente sigue latiendo desde ahí, pero el primer render coincide
        // con el HTML y no hay salto de hidratación.
        serverNowMinutes={minutesNowAr()}
      />
    </>
  );
}

function isIsoDate(value: string | undefined): value is IsoDate {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
