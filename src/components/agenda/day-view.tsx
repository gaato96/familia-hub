"use client";

import { CalendarPlus, ChevronLeft, ChevronRight, Clock, MapPin, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { DayTimeline } from "@/components/agenda/day-timeline";
import { NowStrip } from "@/components/agenda/now-strip";
import { TimeBlockForm } from "@/components/agenda/time-block-form";
import { TaskRow } from "@/components/planner/task-row";
import { Button, Fab } from "@/components/ui/button";
import { Card, EmptyState, SectionHeading } from "@/components/ui/card";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { blocksForDate, timelineRange } from "@/lib/agenda/blocks";
import { eventToAgendaItem, type AgendaItem } from "@/lib/agenda/day";
import { addDaysIso, formatDayLabel, formatTime, type IsoDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { PlannerTask } from "@/lib/planner/queries";
import type { EventRow, FamilyMemberRow, TimeBlockRow } from "@/types/database";

/**
 * La vista diaria.
 *
 * El pedido era tener siempre a mano "qué hay en el día y qué es lo siguiente".
 * Por eso el orden de la pantalla no es cronológico sino por urgencia: primero
 * lo que está pasando AHORA y lo que viene después, y recién abajo el día
 * completo dibujado. Quien abre la app a las cuatro de la tarde no quiere
 * repasar la mañana.
 */
export function DayView({
  date,
  today,
  blocks,
  events,
  tasks,
  members,
  serverNowMinutes,
}: {
  date: IsoDate;
  today: IsoDate;
  blocks: TimeBlockRow[];
  events: EventRow[];
  tasks: PlannerTask[];
  members: FamilyMemberRow[];
  serverNowMinutes: number;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<TimeBlockRow | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const isToday = date === today;
  const byId = new Map(members.map((m) => [m.id, m]));

  const dayBlocks = blocksForDate(blocks, date);
  const { fromHour, toHour } = timelineRange(dayBlocks);

  const timedEvents = events
    .map(eventToAgendaItem)
    .filter((item): item is AgendaItem => item !== null);
  const allDayEvents = events.filter((event) => event.is_all_day);

  const pendingTasks = tasks.filter((t) => t.status === "pending");

  function openNew() {
    setEditing(null);
    setFormOpen(true);
  }

  return (
    <div className="space-y-5">
      <DayStrip date={date} today={today} />

      {/* La franja de "ahora". Solo tiene sentido en el día de hoy: en el
          jueves que viene, "ahora" no significa nada. */}
      {isToday ? (
        <NowStrip
          blocks={blocks}
          events={events}
          date={date}
          members={members}
          serverNowMinutes={serverNowMinutes}
        />
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <section>
          <SectionHeading
            title="El día"
            action={
              <Button variant="ghost" size="sm" onClick={openNew} className="hidden lg:flex">
                <Plus /> Bloque
              </Button>
            }
          />
          <Card className="p-3 pr-4">
            {dayBlocks.length === 0 ? (
              <EmptyState
                icon={<CalendarPlus />}
                title="Todavía no hay bloques"
                hint="Cargá los horarios fijos —trabajo, colegio, siesta, cena— una vez y quedan para todas las semanas."
                action={
                  <Button size="sm" onClick={openNew}>
                    <Plus /> Agregar un bloque
                  </Button>
                }
                className="border-0 bg-transparent"
              />
            ) : (
              <DayTimeline
                blocks={dayBlocks}
                members={members}
                fromHour={fromHour}
                toHour={toHour}
                isToday={isToday}
                serverNowMinutes={serverNowMinutes}
                onSelect={(day) => {
                  setEditing(day.block);
                  setFormOpen(true);
                }}
              />
            )}
          </Card>
        </section>

        <div className="space-y-5">
          {allDayEvents.length > 0 ? (
            <section>
              <SectionHeading title="Todo el día" />
              <ul className="space-y-2">
                {allDayEvents.map((event) => (
                  <li key={event.id}>
                    <Card className="flex items-center gap-2.5 py-3">
                      <span className="size-2 shrink-0 rounded-full bg-secondary" />
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-fg">
                        {event.title}
                      </span>
                    </Card>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {timedEvents.length > 0 ? (
            <section>
              <SectionHeading title="Eventos" count={timedEvents.length} />
              <ul className="space-y-2">
                {events
                  .filter((event) => !event.is_all_day)
                  .map((event) => (
                    <li key={event.id}>
                      <Card className="flex items-start gap-3 py-3">
                        <span className="flex w-14 shrink-0 items-center gap-1 pt-0.5 text-xs font-bold text-secondary">
                          <Clock className="size-3" />
                          {formatTime(event.starts_at)}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-fg">
                            {event.title}
                          </span>
                          {event.location ? (
                            <span className="mt-0.5 flex items-center gap-1 text-xs text-muted">
                              <MapPin className="size-3" />
                              {event.location}
                            </span>
                          ) : null}
                        </span>
                      </Card>
                    </li>
                  ))}
              </ul>
            </section>
          ) : null}

          <section>
            <SectionHeading
              title="Tareas"
              count={pendingTasks.length}
              action={
                <Link
                  href={`/planner?semana=${date}`}
                  className="font-display text-xs font-bold text-primary"
                >
                  Ver la semana
                </Link>
              }
            />
            {tasks.length === 0 ? (
              <EmptyState title="No hay tareas para este día" />
            ) : (
              <Card className="px-2 py-1">
                <ul className="divide-y divide-border">
                  {tasks.map((task) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      assignee={
                        task.assigned_member_id
                          ? byId.get(task.assigned_member_id)
                          : undefined
                      }
                      onChanged={() => router.refresh()}
                    />
                  ))}
                </ul>
              </Card>
            )}
          </section>
        </div>
      </div>

      <Fab onClick={openNew} aria-label="Agregar un bloque de horario" className="lg:hidden">
        <Plus />
      </Fab>

      <Sheet
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditing(null);
        }}
      >
        <SheetContent
          title={editing ? "Editar bloque" : "Nuevo bloque"}
          description={
            editing
              ? undefined
              : "Los horarios fijos de la casa. Se cargan una vez y valen todas las semanas."
          }
        >
          <TimeBlockForm
            // La clave fuerza un formulario nuevo al pasar de editar a crear:
            // sin esto, los campos quedan con los valores del bloque anterior.
            key={editing?.id ?? "nuevo"}
            members={members}
            date={date}
            block={editing ?? undefined}
            onDone={() => {
              setFormOpen(false);
              setEditing(null);
              router.refresh();
            }}
          />
        </SheetContent>
      </Sheet>
    </div>
  );
}

/** Tira de días para moverse sin salir de la pantalla. */
function DayStrip({ date, today }: { date: IsoDate; today: IsoDate }) {
  // Tres días para atrás y tres para adelante, con el elegido en el medio.
  const days = Array.from({ length: 7 }, (_, i) => addDaysIso(date, i - 3));

  return (
    <div className="flex items-center gap-1">
      <Link
        href={`/dia?fecha=${addDaysIso(date, -1)}`}
        aria-label="Día anterior"
        className="grid size-10 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-surface-2"
      >
        <ChevronLeft className="size-5" />
      </Link>

      <ul className="flex min-w-0 flex-1 justify-between gap-1">
        {days.map((day) => {
          const selected = day === date;
          const isToday = day === today;
          const [weekday, dayNumber] = formatDayLabel(day).split(" ");

          return (
            <li key={day} className="min-w-0 flex-1">
              <Link
                href={`/dia?fecha=${day}`}
                aria-current={selected ? "date" : undefined}
                className={cn(
                  "flex flex-col items-center gap-0.5 rounded-app-sm py-2 transition-colors",
                  selected
                    ? "bg-primary text-primary-fg shadow-press"
                    : "text-muted hover:bg-surface-2",
                )}
              >
                <span className="text-[10px] font-bold uppercase leading-none">
                  {weekday?.replace(".", "")}
                </span>
                <span className="font-display text-base font-bold leading-none">
                  {dayNumber}
                </span>
                <span
                  className={cn(
                    "size-1 rounded-full",
                    isToday && !selected && "bg-primary",
                    isToday && selected && "bg-primary-fg",
                  )}
                />
              </Link>
            </li>
          );
        })}
      </ul>

      <Link
        href={`/dia?fecha=${addDaysIso(date, 1)}`}
        aria-label="Día siguiente"
        className="grid size-10 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-surface-2"
      >
        <ChevronRight className="size-5" />
      </Link>
    </div>
  );
}
