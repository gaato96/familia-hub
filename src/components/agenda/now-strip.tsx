"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useSyncExternalStore } from "react";

import { MemberAvatar } from "@/components/app/member-chip";
import { Card } from "@/components/ui/card";
import { blocksForDate, untilLabel } from "@/lib/agenda/blocks";
import {
  blockToAgendaItem,
  eventToAgendaItem,
  happeningNow,
  upcoming,
  type AgendaItem,
} from "@/lib/agenda/day";
import { getNowMinutes, subscribeToNow } from "@/lib/agenda/now-store";
import type { IsoDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { EventRow, FamilyMemberRow, TimeBlockRow } from "@/types/database";

/**
 * "Ahora" y "lo que sigue".
 *
 * Es la única parte de la app que contesta la pregunta con la que alguien saca
 * el teléfono del bolsillo, así que va arriba de todo tanto en el panel como en
 * la vista diaria — y por eso vive acá y no adentro de una de las dos.
 *
 * Se actualiza sola: una franja que dice "ahora" con la información de hace
 * tres horas, porque la pestaña quedó abierta desde la mañana, es peor que no
 * tenerla. El valor del servidor entra como snapshot inicial para que la
 * hidratación no salte.
 */
export function NowStrip({
  blocks,
  events,
  date,
  members,
  serverNowMinutes,
  className,
}: {
  blocks: TimeBlockRow[];
  events: EventRow[];
  date: IsoDate;
  members: FamilyMemberRow[];
  serverNowMinutes: number;
  className?: string;
}) {
  const atMinutes = useSyncExternalStore(
    subscribeToNow,
    getNowMinutes,
    () => serverNowMinutes,
  );

  const byId = new Map(members.map((m) => [m.id, m]));
  const agenda: AgendaItem[] = [
    ...blocksForDate(blocks, date).map(blockToAgendaItem),
    ...events
      .map(eventToAgendaItem)
      .filter((item): item is AgendaItem => item !== null),
  ];

  const now = happeningNow(agenda, atMinutes);
  const next = upcoming(agenda, atMinutes, 3);

  if (agenda.length === 0) {
    return (
      <Card tone="info" className={cn("flex items-center justify-between gap-3", className)}>
        <span className="text-sm font-semibold">
          El día está sin bloques cargados todavía.
        </span>
        <Link
          href="/dia"
          className="flex shrink-0 items-center gap-1 font-display text-xs font-bold"
        >
          Armarlo <ArrowRight className="size-3.5" />
        </Link>
      </Card>
    );
  }

  return (
    <div className={cn("grid gap-3 sm:grid-cols-2", className)}>
      <Card tone="primary" className="min-w-0">
        <p className="mb-2 flex items-center gap-1.5 font-display text-xs font-bold uppercase tracking-wide">
          <span className="size-2 animate-pulse rounded-full bg-current" />
          Ahora
        </p>
        {now.length === 0 ? (
          <p className="text-sm opacity-80">Rato libre.</p>
        ) : (
          <ul className="space-y-1.5">
            {now.map((item) => {
              const owner = item.memberId ? byId.get(item.memberId) : undefined;
              return (
                <li key={item.id} className="flex items-center gap-2">
                  {owner ? <MemberAvatar member={owner} size="sm" /> : null}
                  <span className="min-w-0 flex-1 truncate font-display text-base font-bold">
                    {item.title}
                  </span>
                  {item.endMinutes !== null ? (
                    <span className="shrink-0 text-xs font-bold opacity-75">
                      termina {untilLabel(item.endMinutes - atMinutes)}
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card className="min-w-0">
        <p className="mb-2 font-display text-xs font-bold uppercase tracking-wide text-muted">
          Lo que sigue
        </p>
        {next.length === 0 ? (
          <p className="text-sm text-muted">Nada más por hoy.</p>
        ) : (
          <ul className="space-y-1.5">
            {next.map((item) => {
              const owner = item.memberId ? byId.get(item.memberId) : undefined;
              return (
                <li key={item.id} className="flex items-center gap-2 text-sm">
                  {owner ? (
                    <MemberAvatar member={owner} size="sm" />
                  ) : (
                    <span
                      aria-hidden
                      className={cn(
                        "size-2 shrink-0 rounded-full",
                        item.source === "event" ? "bg-secondary" : "bg-border-strong",
                      )}
                    />
                  )}
                  <span className="min-w-0 flex-1 truncate font-semibold text-fg">
                    {item.title}
                  </span>
                  <span className="shrink-0 text-xs font-bold text-muted">
                    {untilLabel(item.startMinutes - atMinutes)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
