"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";

import { formatBlockTime, type DayBlock } from "@/lib/agenda/blocks";
import { blockGeometry } from "@/lib/agenda/day";
import { getNowMinutes, subscribeToNow } from "@/lib/agenda/now-store";
import { cn } from "@/lib/utils";
import type { FamilyMemberRow } from "@/types/database";

/** Alto de una hora. 52px deja un bloque de 1 h con lugar para título y hora. */
const PX_PER_HOUR = 52;
const GUTTER = "3rem";

/**
 * La línea de tiempo del día.
 *
 * Es la respuesta al pedido de "bloques de horarios": ver de un vistazo que
 * mamá trabaja hasta las 18, que Julián está en el colegio hasta la 13 y que
 * entre medio hay una hora libre. Una lista ordenada por hora no lo muestra —
 * los huecos son justamente lo que hay que ver, y una lista no tiene huecos.
 *
 * Los bloques se dibujan proporcionales al tiempo que ocupan y en columnas
 * cuando se solapan (ver `assignLanes`). El alto mínimo de 28px es lo que evita
 * que un bloque de 15 minutos quede sin lugar ni para su propio título.
 */
export function DayTimeline({
  blocks,
  members,
  fromHour,
  toHour,
  isToday,
  serverNowMinutes,
  onSelect,
}: {
  blocks: DayBlock[];
  members: FamilyMemberRow[];
  fromHour: number;
  toHour: number;
  isToday: boolean;
  /** El mismo valor con el que renderizó el servidor: evita el salto de hidratación. */
  serverNowMinutes: number;
  onSelect?: (block: DayBlock) => void;
}) {
  const nowMinutes = useSyncExternalStore(
    subscribeToNow,
    getNowMinutes,
    () => serverNowMinutes,
  );

  const byId = new Map(members.map((m) => [m.id, m]));
  const hours = Array.from({ length: toHour - fromHour }, (_, i) => fromHour + i);
  const height = (toHour - fromHour) * PX_PER_HOUR;

  const nowOffset = ((nowMinutes - fromHour * 60) / 60) * PX_PER_HOUR;
  const nowVisible = isToday && nowMinutes >= fromHour * 60 && nowMinutes <= toHour * 60;

  // Al abrir el día de hoy, la vista arranca donde está la persona y no a las
  // 7 de la mañana. Es un scroll, no un estado: no hay setState en el efecto.
  const nowRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    nowRef.current?.scrollIntoView({ block: "center" });
  }, []);

  return (
    <div className="relative" style={{ height }}>
      {/* Las horas y sus líneas. */}
      {hours.map((hour, index) => (
        <div
          key={hour}
          className="absolute inset-x-0 flex items-start gap-2"
          style={{ top: index * PX_PER_HOUR, height: PX_PER_HOUR }}
        >
          <span className="w-12 shrink-0 -translate-y-1.5 text-right text-[11px] font-semibold tabular-nums text-muted">
            {hour}:00
          </span>
          <span className="mt-px h-px flex-1 bg-border" />
        </div>
      ))}

      {/* Los bloques. */}
      <div className="absolute inset-y-0 right-0" style={{ left: GUTTER }}>
        {blocks.map((day) => {
          const { top, height: blockHeight } = blockGeometry(day, fromHour, PX_PER_HOUR);
          const owner = day.block.member_id ? byId.get(day.block.member_id) : undefined;
          const accent = owner?.color ?? "var(--app-secondary)";
          const past = isToday && day.endMinutes <= nowMinutes;
          const short = blockHeight < 46;

          const content = (
            <>
              <span
                className={cn(
                  "block truncate font-display text-[13px] font-bold leading-tight text-fg",
                  short && "text-xs",
                )}
              >
                {day.block.title}
              </span>
              {!short ? (
                <span className="mt-0.5 block truncate text-[11px] leading-tight text-muted">
                  {formatBlockTime(day.block.starts_at)} a{" "}
                  {formatBlockTime(day.block.ends_at)}
                  {owner ? ` · ${owner.display_name.split(" ")[0]}` : ""}
                </span>
              ) : null}
            </>
          );

          const style = {
            top,
            height: blockHeight,
            left: `calc(${(day.lane / day.laneCount) * 100}% + 0.5rem)`,
            width: `calc(${(1 / day.laneCount) * 100}% - 0.75rem)`,
            borderLeftColor: accent,
            backgroundColor: owner ? `${owner.color}1f` : undefined,
          };

          const className = cn(
            "absolute overflow-hidden rounded-app-sm border-l-[3px] px-2.5 py-1.5 text-left",
            "transition-opacity",
            !owner && "bg-secondary-soft",
            past && "opacity-45",
            onSelect && "hover:opacity-100 hover:shadow-card",
          );

          return onSelect ? (
            <button
              key={day.block.id}
              type="button"
              onClick={() => onSelect(day)}
              style={style}
              className={className}
            >
              {content}
            </button>
          ) : (
            <div key={day.block.id} style={style} className={className}>
              {content}
            </div>
          );
        })}
      </div>

      {/* Ahora. Se dibuja al final para que quede por encima de los bloques. */}
      {nowVisible ? (
        <div
          ref={nowRef}
          className="pointer-events-none absolute inset-x-0 z-10 flex items-center gap-1.5"
          style={{ top: nowOffset }}
          aria-hidden
        >
          <span className="w-12 shrink-0 text-right text-[11px] font-bold tabular-nums text-primary">
            {String(Math.floor(nowMinutes / 60)).padStart(2, "0")}:
            {String(nowMinutes % 60).padStart(2, "0")}
          </span>
          <span className="size-2 shrink-0 rounded-full bg-primary" />
          <span className="h-px flex-1 bg-primary" />
        </div>
      ) : null}
    </div>
  );
}
