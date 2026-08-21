"use client";

import { ChevronLeft, ChevronRight, Clock, MapPin, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { WeekBlocks } from "@/components/agenda/week-blocks";
import { MemberAvatar } from "@/components/app/member-chip";
import { PlannerComposer } from "@/components/planner/planner-composer";
import { TaskRow } from "@/components/planner/task-row";
import { Button } from "@/components/ui/button";
import { Card, SectionHeading } from "@/components/ui/card";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import {
  addDaysIso,
  formatDayLabel,
  formatTime,
  weekDaysAr,
  type IsoDate,
} from "@/lib/dates";
import type { PlannerTask } from "@/lib/planner/queries";
import { cn } from "@/lib/utils";
import type { EventRow, FamilyMemberRow, TimeBlockRow } from "@/types/database";

export function WeekView({
  monday,
  today,
  tasks,
  events,
  members,
  blocks,
  currentMemberId,
  filterMemberId,
  serverNowMinutes,
}: {
  monday: IsoDate;
  today: IsoDate;
  tasks: PlannerTask[];
  events: EventRow[];
  members: FamilyMemberRow[];
  blocks: TimeBlockRow[];
  currentMemberId: string;
  filterMemberId: string | null;
  serverNowMinutes: number;
}) {
  const router = useRouter();
  const [composerOpen, setComposerOpen] = useState(false);

  const days = weekDaysAr(monday);
  const byId = new Map(members.map((m) => [m.id, m]));

  // El filtro se aplica solo a las tareas. Un evento familiar sigue siendo de
  // todos aunque se esté mirando la agenda de una persona: si desapareciera,
  // "la agenda de mamá" no mostraría el cumpleaños al que va toda la casa.
  const visibleTasks = filterMemberId
    ? tasks.filter((t) => t.assigned_member_id === filterMemberId)
    : tasks;

  const weekHref = (isoMonday: IsoDate) => {
    const params = new URLSearchParams({ semana: isoMonday });
    if (filterMemberId) params.set("quien", filterMemberId);
    return `/planner?${params}`;
  };

  const filterHref = (memberId: string | null) => {
    const params = new URLSearchParams({ semana: monday });
    if (memberId) params.set("quien", memberId);
    return `/planner?${params}`;
  };

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between gap-2">
        <Link
          href={weekHref(addDaysIso(monday, -7))}
          aria-label="Semana anterior"
          className="grid size-10 place-items-center rounded-full text-muted hover:bg-surface-2"
        >
          <ChevronLeft className="size-5" />
        </Link>

        <div className="text-center">
          <h1 className="font-display text-lg font-bold text-fg lg:text-2xl">
            {weekTitle(monday)}
          </h1>
          <p className="text-xs text-muted">
            {formatDayLabel(monday)} al {formatDayLabel(addDaysIso(monday, 6))}
          </p>
        </div>

        <Link
          href={weekHref(addDaysIso(monday, 7))}
          aria-label="Semana siguiente"
          className="grid size-10 place-items-center rounded-full text-muted hover:bg-surface-2"
        >
          <ChevronRight className="size-5" />
        </Link>
      </header>

      {/* Filtro por integrante. Scroll horizontal sin barra: en una familia de
          cinco no entran los chips, y una fila que se desliza es más natural
          que un desplegable. */}
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
        <FilterChip href={filterHref(null)} active={filterMemberId === null}>
          Toda la casa
        </FilterChip>
        {members.map((m) => (
          <FilterChip
            key={m.id}
            href={filterHref(m.id)}
            active={filterMemberId === m.id}
          >
            <MemberAvatar member={m} size="sm" />
            {m.display_name}
          </FilterChip>
        ))}
      </div>

      {/* Los horarios de la semana antes de las tareas: el pedido era ver "qué
          hay durante la semana", y eso empieza por dónde está cada uno. El
          detalle de cada día está a un toque de distancia. */}
      <section>
        <SectionHeading
          title="Horarios"
          action={
            <Link href="/dia" className="font-display text-xs font-bold text-primary">
              Ver el día
            </Link>
          }
        />
        <Card className="p-3">
          <WeekBlocks
            days={days}
            today={today}
            blocks={blocks}
            members={members}
            serverNowMinutes={serverNowMinutes}
          />
        </Card>
      </section>

      <SectionHeading title="Tareas y eventos" className="!mb-0 pt-1" />

      <ol className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
        {days.map((day) => {
          const dayTasks = visibleTasks.filter((t) => t.due_date === day);
          const dayEvents = events.filter((e) => sameDay(e, day));
          const isToday = day === today;
          const isEmpty = dayTasks.length === 0 && dayEvents.length === 0;

          return (
            <li
              key={day}
              className={cn(
                "rounded-app bg-surface p-3 shadow-card",
                isToday && "ring-2 ring-primary",
              )}
            >
              <div className="mb-2 flex items-baseline justify-between">
                <h2
                  className={cn(
                    "font-display text-sm font-bold capitalize",
                    isToday ? "text-primary" : "text-fg",
                  )}
                >
                  {formatDayLabel(day)}
                  {isToday ? <span className="ml-1.5 font-medium">· hoy</span> : null}
                </h2>
                {isEmpty ? <span className="text-xs text-muted">libre</span> : null}
              </div>

              {dayEvents.length > 0 ? (
                <ul className="mb-2 space-y-1.5">
                  {dayEvents.map((event) => (
                    <li
                      key={event.id}
                      className="flex items-start gap-2 rounded-lg bg-surface-2 px-2.5 py-2"
                    >
                      <span className="mt-0.5 flex shrink-0 items-center gap-1 text-xs font-semibold text-primary">
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
                        <span className="block truncate text-sm text-fg">{event.title}</span>
                        {event.location ? (
                          <span className="flex items-center gap-1 text-xs text-muted">
                            <MapPin className="size-3" />
                            {event.location}
                          </span>
                        ) : null}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}

              {dayTasks.length > 0 ? (
                <ul className="space-y-1">
                  {dayTasks.map((task) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      assignee={
                        task.assigned_member_id ? byId.get(task.assigned_member_id) : undefined
                      }
                      onChanged={() => router.refresh()}
                    />
                  ))}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ol>

      <Button onClick={() => setComposerOpen(true)} size="lg" className="w-full">
        <Plus /> Agregar
      </Button>

      <Sheet open={composerOpen} onOpenChange={setComposerOpen}>
        <SheetContent title="Agregar al planner">
          <PlannerComposer
            members={members}
            currentMemberId={currentMemberId}
            defaultDate={today}
            onDone={() => {
              setComposerOpen(false);
              router.refresh();
            }}
          />
        </SheetContent>
      </Sheet>
    </div>
  );
}

function FilterChip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={active ? "true" : undefined}
      className={cn(
        "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium",
        active
          ? "border-primary bg-primary text-primary-fg"
          : "border-border bg-surface text-muted",
      )}
    >
      {children}
    </Link>
  );
}

/** Un evento pertenece al día argentino en el que arranca. */
function sameDay(event: EventRow, day: IsoDate): boolean {
  return (
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Argentina/Buenos_Aires",
    }).format(new Date(event.starts_at)) === day
  );
}

function weekTitle(monday: IsoDate): string {
  return new Intl.DateTimeFormat("es-AR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(Date.parse(`${monday}T12:00:00Z`));
}
