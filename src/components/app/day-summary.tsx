import { Clock, MapPin } from "lucide-react";

import { MemberAvatar, UnassignedChip } from "@/components/app/member-chip";
import { EmptyState } from "@/components/ui/card";
import { formatTime } from "@/lib/dates";
import type { PlannerTask } from "@/lib/planner/queries";
import type { EventRow, FamilyMemberRow } from "@/types/database";

/**
 * Lo de hoy, para toda la casa. Es la respuesta a "que todos sepan qué hace
 * cada uno" sin tener que entrar a cada sección.
 *
 * Componente de servidor y sin estado: es una lectura. Tildar una tarea se
 * hace en el planner, donde hay lugar para la confirmación y para deshacer.
 */
export function DaySummary({
  tasks,
  events,
  members,
}: {
  tasks: PlannerTask[];
  events: EventRow[];
  members: FamilyMemberRow[];
}) {
  const byId = new Map(members.map((m) => [m.id, m]));

  if (tasks.length === 0 && events.length === 0) {
    return (
      <EmptyState
        title="Hoy no hay nada agendado"
        hint="Ni tareas ni eventos. Disfrutalo."
      />
    );
  }

  return (
    <div className="space-y-3">
      {events.length > 0 ? (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-muted">Hoy pasa esto</h2>
          <ul className="space-y-2">
            {events.map((event) => (
              <li
                key={event.id}
                className="flex items-start gap-3 rounded-app border border-border bg-surface p-3"
              >
                <span className="mt-0.5 flex w-14 shrink-0 items-center gap-1 text-xs font-semibold text-primary">
                  {event.is_all_day ? (
                    "Todo el día"
                  ) : (
                    <>
                      <Clock className="size-3" />
                      {formatTime(event.starts_at)}
                    </>
                  )}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-fg">
                    {event.title}
                  </span>
                  {event.location ? (
                    <span className="mt-0.5 flex items-center gap-1 text-xs text-muted">
                      <MapPin className="size-3" />
                      {event.location}
                    </span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {tasks.length > 0 ? (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-muted">Tareas de hoy</h2>
          <ul className="space-y-2">
            {tasks.map((task) => {
              const assignee = task.assigned_member_id
                ? byId.get(task.assigned_member_id)
                : undefined;
              const done = task.status === "done";

              return (
                <li
                  key={task.id}
                  className="flex items-center gap-3 rounded-app border border-border bg-surface p-3"
                >
                  {assignee ? (
                    <MemberAvatar member={assignee} />
                  ) : (
                    <UnassignedChip />
                  )}
                  <span
                    className={
                      done
                        ? "min-w-0 flex-1 truncate text-sm text-muted line-through"
                        : "min-w-0 flex-1 truncate text-sm text-fg"
                    }
                  >
                    {task.task?.title ?? "Tarea"}
                  </span>
                  {done ? (
                    <span className="shrink-0 text-xs font-semibold text-success">Listo</span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
