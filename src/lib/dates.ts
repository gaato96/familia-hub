/**
 * Fechas de la app, ancladas a Argentina.
 *
 * Argentina no tiene horario de verano desde 2009, así que el offset es fijo
 * en -03:00 y no hace falta una librería de husos. Si algún día vuelve el DST,
 * o si esto se reusa para otra región, TODO este archivo hay que rehacerlo con
 * zonas reales — no alcanza con cambiar la constante.
 */

export const AR_OFFSET_MINUTES = -180;
export const AR_TIME_ZONE = "America/Argentina/Buenos_Aires";

export type IsoDate = string; // YYYY-MM-DD

/** Hoy en Argentina, sin importar dónde corra el proceso. */
export function todayInAr(now: Date = new Date()): IsoDate {
  return new Date(now.getTime() + AR_OFFSET_MINUTES * 60_000).toISOString().slice(0, 10);
}

/** El instante UTC que corresponde a las 00:00 argentinas de esa fecha. */
export function startOfDayAr(date: IsoDate): Date {
  return new Date(`${date}T00:00:00-03:00`);
}

export function endOfDayAr(date: IsoDate): Date {
  return new Date(`${date}T23:59:59.999-03:00`);
}

/**
 * Lunes de la semana que contiene a `date`.
 *
 * La semana del planner arranca el lunes, no el domingo: es cómo se habla de la
 * semana acá, y el pedido era "todos los domingos o lunes ver qué hay durante
 * la semana" — con el domingo al final, la vista del domingo a la noche muestra
 * la semana que viene entera.
 */
export function startOfWeekAr(date: IsoDate): IsoDate {
  const epoch = Date.parse(`${date}T00:00:00Z`);
  const dow = new Date(epoch).getUTCDay(); // 0 = domingo
  const backToMonday = dow === 0 ? 6 : dow - 1;
  return new Date(epoch - backToMonday * 86_400_000).toISOString().slice(0, 10);
}

/**
 * Día de la semana en numeración ISO: 1 = lunes ... 7 = domingo.
 *
 * `getUTCDay()` devuelve 0 para el domingo, que además de no ser ISO lo pone
 * al principio de la semana. Como acá la semana arranca el lunes y así se
 * guardan los `weekdays` de los bloques de horarios, la conversión vive en un
 * solo lugar.
 */
export function isoWeekday(date: IsoDate): number {
  const dow = new Date(Date.parse(`${date}T00:00:00Z`)).getUTCDay();
  return dow === 0 ? 7 : dow;
}

export function addDaysIso(date: IsoDate, days: number): IsoDate {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000)
    .toISOString()
    .slice(0, 10);
}

/** Los siete días de la semana que contiene a `date`, de lunes a domingo. */
export function weekDaysAr(date: IsoDate): IsoDate[] {
  const monday = startOfWeekAr(date);
  return Array.from({ length: 7 }, (_, i) => addDaysIso(monday, i));
}

// ---------------------------------------------------------------------------
// Formato
// ---------------------------------------------------------------------------
const LOCALE = "es-AR";

export function formatDayLabel(date: IsoDate): string {
  return new Intl.DateTimeFormat(LOCALE, {
    weekday: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(Date.parse(`${date}T12:00:00Z`));
}

export function formatLongDate(date: IsoDate): string {
  return new Intl.DateTimeFormat(LOCALE, {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(Date.parse(`${date}T12:00:00Z`));
}

/**
 * "20:58" y no "08:58 p. m.".
 *
 * `es-AR` por defecto formatea en 12 horas con "a. m."/"p. m.", que ocupa el
 * doble de ancho y no es como se dice la hora acá. `hour12: false` es
 * obligatorio además para que las horas de los eventos se lean igual que las
 * de los bloques, que salen de un `time` de Postgres.
 */
export function formatTime(instant: string | Date): string {
  return new Intl.DateTimeFormat(LOCALE, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: AR_TIME_ZONE,
  }).format(typeof instant === "string" ? new Date(instant) : instant);
}

/** "hoy", "mañana", "en 3 días", "hace 2 días". */
export function relativeDayLabel(date: IsoDate, today: IsoDate = todayInAr()): string {
  const diff = Math.round(
    (Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000,
  );

  if (diff === 0) return "hoy";
  if (diff === 1) return "mañana";
  if (diff === -1) return "ayer";
  if (diff > 1) return `en ${diff} días`;
  return `hace ${Math.abs(diff)} días`;
}

export function isOverdue(date: IsoDate, today: IsoDate = todayInAr()): boolean {
  return date < today;
}
