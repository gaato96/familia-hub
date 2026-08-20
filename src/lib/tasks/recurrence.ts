import { z } from "zod";

import type { Recurrence } from "@/types/database";

/**
 * Cálculo de ocurrencias — gemelo en TypeScript de `ensure_task_instances()`
 * (supabase/migrations/20260820120600_task_generation.sql).
 *
 * LAS DOS TIENEN QUE CAMBIAR JUNTAS. La de SQL es la que materializa las filas;
 * esta es la que muestra "próximas fechas" mientras se arma la tarea. Si se
 * separan, el usuario ve una previsualización que no es lo que va a pasar.
 *
 * Toda la aritmética es en UTC a propósito. Son fechas sin hora ("el 15 de
 * septiembre"), y hacer `new Date(2026, 8, 15)` en una máquina con otro huso
 * puede correr el día al sumar meses. Trabajar en UTC saca el problema de raíz
 * sin depender de en qué zona corre el server.
 */

export type IsoDate = string; // YYYY-MM-DD

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// ---------------------------------------------------------------------------
// Helpers de fecha en UTC
// ---------------------------------------------------------------------------
function toEpoch(iso: IsoDate): number {
  if (!ISO_DATE.test(iso)) throw new Error(`Fecha inválida: ${iso}`);
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function toIso(epoch: number): IsoDate {
  return new Date(epoch).toISOString().slice(0, 10);
}

const DAY_MS = 86_400_000;

function addDays(epoch: number, days: number): number {
  return epoch + days * DAY_MS;
}

/** 0 = domingo, igual que `extract(dow ...)` en Postgres. */
function dayOfWeek(epoch: number): number {
  return new Date(epoch).getUTCDay();
}

function startOfMonth(epoch: number): number {
  const d = new Date(epoch);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
}

function addMonths(epoch: number, months: number): number {
  const d = new Date(epoch);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, d.getUTCDate());
}

function daysInMonth(epoch: number): number {
  const d = new Date(epoch);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
}

// ---------------------------------------------------------------------------
// Validación
// ---------------------------------------------------------------------------
export const recurrenceSchema: z.ZodType<Recurrence> = z.discriminatedUnion("freq", [
  z.object({ freq: z.literal("days"), interval: z.number().int().min(1).max(365) }),
  z.object({
    freq: z.literal("weekly"),
    byweekday: z.array(z.number().int().min(0).max(6)).min(1).max(7),
  }),
  z.object({ freq: z.literal("monthly"), bymonthday: z.number().int().min(1).max(31) }),
]);

// ---------------------------------------------------------------------------
// Generación
// ---------------------------------------------------------------------------
/** Techo duro, igual que el `least(p_until, current_date + 400)` del SQL. */
const MAX_HORIZON_DAYS = 400;

export type OccurrenceOptions = {
  /** Ancla de la regla: `tasks.starts_on`. */
  startsOn: IsoDate;
  /** Última fecha a generar, inclusive. */
  until: IsoDate;
  /** Descarta lo anterior a esta fecha. Por defecto, desde `startsOn`. */
  from?: IsoDate;
  /** Corta después de N resultados. Para previsualizar "las próximas 5". */
  limit?: number;
  /**
   * Hoy, para el techo de horizonte. Inyectable solo para los tests: el SQL usa
   * `current_date`, así que dejarlo libre haría divergir las dos mitades.
   */
  today?: IsoDate;
};

/**
 * Devuelve las fechas de vencimiento de una regla, ordenadas.
 *
 * Una tarea puntual (`rule === null`) tiene exactamente una ocurrencia, en
 * `startsOn` — el mismo criterio que el trigger `tasks_seed_one_off()`.
 */
export function occurrencesBetween(
  rule: Recurrence | null,
  { startsOn, until, from, limit, today }: OccurrenceOptions,
): IsoDate[] {
  const start = toEpoch(startsOn);
  const lowerBound = from ? Math.max(toEpoch(from), start) : start;
  // El techo cuelga de HOY, no de startsOn — igual que el
  // `least(p_until, current_date + 400)` del SQL. Con una tarea vieja, colgarlo
  // de startsOn daría cero ocurrencias donde la base genera las de este mes.
  const hardCeiling = addDays(
    toEpoch(today ?? new Date().toISOString().slice(0, 10)),
    MAX_HORIZON_DAYS,
  );
  const end = Math.min(toEpoch(until), hardCeiling);

  if (end < lowerBound) return [];

  const out: IsoDate[] = [];
  const push = (epoch: number) => {
    if (epoch >= lowerBound && epoch <= end) out.push(toIso(epoch));
  };
  const done = () => limit !== undefined && out.length >= limit;

  if (rule === null) {
    push(start);
    return out;
  }

  switch (rule.freq) {
    case "days": {
      for (let cursor = start; cursor <= end && !done(); cursor = addDays(cursor, rule.interval)) {
        push(cursor);
      }
      break;
    }

    case "weekly": {
      const wanted = new Set(rule.byweekday);
      for (let cursor = start; cursor <= end && !done(); cursor = addDays(cursor, 1)) {
        if (wanted.has(dayOfWeek(cursor))) push(cursor);
      }
      break;
    }

    case "monthly": {
      for (
        let month = startOfMonth(start);
        month <= end && !done();
        month = addMonths(month, 1)
      ) {
        // "El 31 de cada mes" en febrero cae el 28 (o 29). Se recorta al último
        // día en vez de saltear el mes: la tarea igual hay que hacerla.
        const day = Math.min(rule.bymonthday, daysInMonth(month));
        push(addDays(month, day - 1));
      }
      break;
    }
  }

  return limit === undefined ? out : out.slice(0, limit);
}

/**
 * A quién le toca la ocurrencia número `index` (0-based) de una tarea.
 *
 * Rotación determinística por número de ocurrencia: no hay puntero guardado
 * que se pueda desincronizar si se borra o se regenera una instancia.
 * Espeja `rotation_member_ids[1 + (v_seq % v_len)]` del SQL — donde los arrays
 * de Postgres arrancan en 1 y los de JS en 0.
 */
export function assigneeForOccurrence(
  rotationMemberIds: readonly string[],
  index: number,
): string | null {
  if (rotationMemberIds.length === 0) return null;
  return rotationMemberIds[index % rotationMemberIds.length];
}

// ---------------------------------------------------------------------------
// Texto para la UI
// ---------------------------------------------------------------------------
const WEEKDAY_NAMES = [
  "domingo",
  "lunes",
  "martes",
  "miércoles",
  "jueves",
  "viernes",
  "sábado",
] as const;

/** "cada 15 días", "lunes y jueves", "el 28 de cada mes". */
export function describeRecurrence(rule: Recurrence | null): string {
  if (rule === null) return "una sola vez";

  switch (rule.freq) {
    case "days":
      if (rule.interval === 1) return "todos los días";
      if (rule.interval === 7) return "una vez por semana";
      return `cada ${rule.interval} días`;

    case "weekly": {
      const days = [...rule.byweekday].sort((a, b) => a - b).map((d) => WEEKDAY_NAMES[d]);
      if (days.length === 7) return "todos los días";
      if (days.length === 1) return `todos los ${days[0]}`;
      const last = days.pop();
      return `${days.join(", ")} y ${last}`;
    }

    case "monthly":
      return rule.bymonthday === 1
        ? "el 1 de cada mes"
        : `el ${rule.bymonthday} de cada mes`;
  }
}
