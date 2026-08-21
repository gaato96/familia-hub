import type { DayBlock } from "@/lib/agenda/blocks";
import { AR_OFFSET_MINUTES } from "@/lib/dates";
import type { EventRow } from "@/types/database";

/**
 * "Qué está pasando ahora y qué viene después."
 *
 * Es la única pregunta que la vista diaria tiene que contestar de un vistazo,
 * y mezcla dos cosas que la base guarda distinto: los bloques (hora local,
 * sin fecha) y los eventos (`timestamptz`). Acá se unifican en minutos desde
 * la medianoche argentina, que es la unidad con la que se dibuja.
 */

export type AgendaItem = {
  id: string;
  title: string;
  /** Minutos desde la medianoche AR. */
  startMinutes: number;
  /** null en un evento sin duración. */
  endMinutes: number | null;
  source: "block" | "event";
  memberId: string | null;
  detail: string | null;
};

/** Minutos desde la medianoche argentina de un instante UTC. */
export function minutesOfDayAr(instant: string | Date): number {
  const date = typeof instant === "string" ? new Date(instant) : instant;
  const shifted = new Date(date.getTime() + AR_OFFSET_MINUTES * 60_000);
  return shifted.getUTCHours() * 60 + shifted.getUTCMinutes();
}

export function blockToAgendaItem(day: DayBlock): AgendaItem {
  return {
    id: day.block.id,
    title: day.block.title,
    startMinutes: day.startMinutes,
    endMinutes: day.endMinutes,
    source: "block",
    memberId: day.block.member_id,
    detail: day.block.notes,
  };
}

export function eventToAgendaItem(event: EventRow): AgendaItem | null {
  // Un evento de todo el día no tiene hora: ponerlo en la línea de tiempo a
  // las 00:00 lo dejaría arriba de todo pretendiendo que arranca a la
  // medianoche. Va aparte, en la franja de "hoy además".
  if (event.is_all_day) return null;

  const start = minutesOfDayAr(event.starts_at);
  return {
    id: event.id,
    title: event.title,
    startMinutes: start,
    endMinutes: event.ends_at ? minutesOfDayAr(event.ends_at) : null,
    source: "event",
    memberId: null,
    detail: event.location,
  };
}

/**
 * Lo que viene, de acá en más.
 *
 * Solo mira hacia adelante: lo que ya pasó no ayuda a decidir nada a las
 * cuatro de la tarde. Un bloque que ya arrancó pero sigue en curso NO aparece
 * — ese es "lo de ahora", y se muestra en su propio lugar.
 */
export function upcoming(
  items: AgendaItem[],
  atMinutes: number,
  limit = 4,
): AgendaItem[] {
  return items
    .filter((item) => item.startMinutes > atMinutes)
    .sort((a, b) => a.startMinutes - b.startMinutes)
    .slice(0, limit);
}

/** Lo que está en curso ahora mismo, sean bloques o eventos con duración. */
export function happeningNow(items: AgendaItem[], atMinutes: number): AgendaItem[] {
  return items
    .filter(
      (item) =>
        item.startMinutes <= atMinutes &&
        item.endMinutes !== null &&
        atMinutes < item.endMinutes,
    )
    .sort((a, b) => (a.endMinutes ?? 0) - (b.endMinutes ?? 0));
}

/** Alto en píxeles de un bloque dentro de la línea de tiempo. */
export function blockGeometry(
  day: { startMinutes: number; endMinutes: number },
  fromHour: number,
  pxPerHour: number,
): { top: number; height: number } {
  const top = ((day.startMinutes - fromHour * 60) / 60) * pxPerHour;
  // Piso de 28px: un bloque de 15 minutos con el alto proporcional no tiene
  // lugar ni para su propio título.
  const height = Math.max(28, ((day.endMinutes - day.startMinutes) / 60) * pxPerHour);
  return { top, height };
}
