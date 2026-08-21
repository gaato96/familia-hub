"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";

import { blocksForDate, timelineRange, type DayBlock } from "@/lib/agenda/blocks";
import { blockGeometry } from "@/lib/agenda/day";
import { getNowMinutes, subscribeToNow } from "@/lib/agenda/now-store";
import { formatDayLabel, type IsoDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { FamilyMemberRow, TimeBlockRow } from "@/types/database";

/** Compacto: la semana entera tiene que entrar sin scrollear tres pantallas. */
const PX_PER_HOUR = 26;

/**
 * Los bloques de la semana, siete columnas.
 *
 * Sirve para una pregunta distinta a la de la vista diaria: no "qué me toca
 * ahora" sino "cuándo tenemos un hueco los dos". Por eso acá los bloques casi
 * no llevan texto —a 26px la hora no entra un título— y lo que se lee es la
 * forma: dónde hay color y dónde no.
 *
 * Cada columna es un link al día, que es donde sí se ve el detalle.
 */
export function WeekBlocks({
  days,
  today,
  blocks,
  members,
  serverNowMinutes,
}: {
  days: IsoDate[];
  today: IsoDate;
  blocks: TimeBlockRow[];
  members: FamilyMemberRow[];
  serverNowMinutes: number;
}) {
  const atMinutes = useSyncExternalStore(
    subscribeToNow,
    getNowMinutes,
    () => serverNowMinutes,
  );

  const byId = new Map(members.map((m) => [m.id, m]));
  const perDay: { date: IsoDate; blocks: DayBlock[] }[] = days.map((date) => ({
    date,
    blocks: blocksForDate(blocks, date),
  }));

  // Una sola ventana horaria para las siete columnas: con una por día, el
  // mismo bloque de las 9 quedaría a distinta altura cada día y la semana
  // dejaría de leerse de un vistazo.
  const { fromHour, toHour } = timelineRange(perDay.flatMap((d) => d.blocks));
  const hours = Array.from({ length: toHour - fromHour }, (_, i) => fromHour + i);
  const height = (toHour - fromHour) * PX_PER_HOUR;

  if (blocks.length === 0) {
    return (
      <p className="rounded-app border border-dashed border-border-strong px-4 py-6 text-center text-sm text-muted">
        Sin horarios cargados.{" "}
        <Link href="/dia" className="font-bold text-primary">
          Armá el día
        </Link>{" "}
        y la semana se dibuja sola.
      </p>
    );
  }

  return (
    <div className="flex gap-1 overflow-x-auto no-scrollbar">
      {/* Columna de horas. */}
      <div className="relative shrink-0" style={{ height, width: "1.75rem" }}>
        {hours.map((hour, index) => (
          <span
            key={hour}
            className="absolute right-0 -translate-y-1.5 text-[10px] font-semibold tabular-nums text-muted"
            style={{ top: index * PX_PER_HOUR }}
          >
            {hour}
          </span>
        ))}
      </div>

      {perDay.map(({ date, blocks: dayBlocks }) => {
        const isToday = date === today;
        const [weekday, dayNumber] = formatDayLabel(date).split(" ");

        return (
          <Link
            key={date}
            href={`/dia?fecha=${date}`}
            className="min-w-[3.25rem] flex-1 rounded-app-sm px-0.5 pb-1 transition-colors hover:bg-surface-2"
          >
            <span
              className={cn(
                "mb-1 flex flex-col items-center rounded-app-sm py-1 text-[10px] font-bold uppercase",
                isToday ? "bg-primary text-primary-fg" : "text-muted",
              )}
            >
              <span>{weekday?.replace(".", "")}</span>
              <span className="font-display text-xs">{dayNumber}</span>
            </span>

            <span className="relative block" style={{ height }}>
              {hours.map((hour, index) => (
                <span
                  key={hour}
                  className="absolute inset-x-0 h-px bg-border"
                  style={{ top: index * PX_PER_HOUR }}
                />
              ))}

              {dayBlocks.map((day) => {
                const geo = blockGeometry(day, fromHour, PX_PER_HOUR);
                const owner = day.block.member_id ? byId.get(day.block.member_id) : undefined;

                return (
                  <span
                    key={day.block.id}
                    title={day.block.title}
                    className={cn(
                      "absolute overflow-hidden rounded-[4px] px-1 text-[9px] font-bold leading-[10px] text-fg",
                      !owner && "bg-secondary-soft",
                    )}
                    style={{
                      // El piso de 28px de blockGeometry es para la vista
                      // diaria; acá, a 26px la hora, aplastaría media mañana.
                      top: geo.top,
                      height: Math.max(
                        8,
                        ((day.endMinutes - day.startMinutes) / 60) * PX_PER_HOUR,
                      ),
                      left: `calc(${(day.lane / day.laneCount) * 100}% + 1px)`,
                      width: `calc(${(1 / day.laneCount) * 100}% - 2px)`,
                      backgroundColor: owner ? `${owner.color}33` : undefined,
                      borderLeft: `2px solid ${owner?.color ?? "var(--app-secondary)"}`,
                    }}
                  >
                    {day.laneCount === 1 ? day.block.title : ""}
                  </span>
                );
              })}

              {isToday && atMinutes >= fromHour * 60 && atMinutes <= toHour * 60 ? (
                <span
                  aria-hidden
                  className="absolute inset-x-0 h-0.5 bg-primary"
                  style={{ top: ((atMinutes - fromHour * 60) / 60) * PX_PER_HOUR }}
                />
              ) : null}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
