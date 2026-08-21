import { isoWeekday, type IsoDate } from "@/lib/dates";
import type { TimeBlockKind, TimeBlockRow } from "@/types/database";

/**
 * Bloques de horarios: la forma del día.
 *
 * A diferencia de las tareas, los bloques NO se materializan en la base. Una
 * casa tiene veinte o treinta bloques en total; expandirlos a la fecha que se
 * está mirando cuesta menos que una query, y así hay una sola implementación
 * de la regla en vez de dos que se pueden desincronizar (que es exactamente el
 * problema que arrastran `ensure_task_instances()` y `recurrence.ts`).
 *
 * Todo lo de acá adentro trabaja en MINUTOS desde la medianoche. Es la unidad
 * que se necesita para dibujar —una posición en píxeles es una regla de tres—
 * y evita crear veinte objetos Date por render.
 */

export const TIME_BLOCK_KINDS: {
  value: TimeBlockKind;
  label: string;
  /** Token de color de la paleta. Ver globals.css. */
  tone: "info" | "primary" | "success" | "warning" | "neutral";
}[] = [
  { value: "trabajo", label: "Trabajo", tone: "info" },
  { value: "estudio", label: "Estudio", tone: "primary" },
  { value: "cuidado", label: "Cuidado", tone: "warning" },
  { value: "comida", label: "Comida", tone: "success" },
  { value: "descanso", label: "Descanso", tone: "neutral" },
  { value: "traslado", label: "Traslado", tone: "neutral" },
  { value: "ocio", label: "Ocio", tone: "success" },
  { value: "otro", label: "Otro", tone: "neutral" },
];

export function blockKindLabel(kind: TimeBlockKind): string {
  return TIME_BLOCK_KINDS.find((k) => k.value === kind)?.label ?? "Otro";
}

export function blockKindTone(kind: TimeBlockKind) {
  return TIME_BLOCK_KINDS.find((k) => k.value === kind)?.tone ?? "neutral";
}

// ---------------------------------------------------------------------------
// Tiempo
// ---------------------------------------------------------------------------

/**
 * "09:30:00" o "09:30" -> 570.
 *
 * Postgres devuelve `time` con segundos; un `<input type="time">` los omite.
 * Los dos entran acá.
 */
export function minutesFromTime(time: string): number {
  const [h = "0", m = "0"] = time.split(":");
  return Number(h) * 60 + Number(m);
}

/** 570 -> "09:30". */
export function timeFromMinutes(minutes: number): string {
  const clamped = Math.max(0, Math.min(24 * 60, Math.round(minutes)));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** "9:30" cuando es en punto se muestra "9", que es como se dice. */
export function formatBlockTime(time: string): string {
  const minutes = minutesFromTime(time);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}` : `${h}:${String(m).padStart(2, "0")}`;
}

export function formatBlockRange(startsAt: string, endsAt: string): string {
  return `${formatBlockTime(startsAt)} a ${formatBlockTime(endsAt)} h`;
}

/** Minutos transcurridos del día argentino. */
export function minutesNowAr(now: Date = new Date()): number {
  const shifted = new Date(now.getTime() - 3 * 3_600_000);
  return shifted.getUTCHours() * 60 + shifted.getUTCMinutes();
}

// ---------------------------------------------------------------------------
// Expansión
// ---------------------------------------------------------------------------

export type DayBlock = {
  block: TimeBlockRow;
  startMinutes: number;
  endMinutes: number;
  /** Columna dentro de su grupo de solapados. */
  lane: number;
  /** Cuántas columnas usa ese grupo. Con 1, el bloque ocupa todo el ancho. */
  laneCount: number;
};

/** Si el bloque aplica a esa fecha. */
export function blockAppliesOn(block: TimeBlockRow, date: IsoDate): boolean {
  if (block.on_date !== null) return block.on_date === date;
  if (!block.weekdays || block.weekdays.length === 0) return false;

  // La vigencia acota al recurrente: cambiar de horario se resuelve cerrando
  // el bloque viejo, no borrándolo, así el planner del mes pasado no miente.
  if (block.starts_on !== null && date < block.starts_on) return false;
  if (block.ends_on !== null && date > block.ends_on) return false;

  return block.weekdays.includes(isoWeekday(date));
}

/**
 * Reparte los bloques solapados en columnas.
 *
 * Sin esto, "trabajo de mamá 9-18" y "colegio de Julián 8-13" se dibujan uno
 * encima del otro y el de abajo desaparece. El algoritmo es el clásico de
 * agenda: agrupar en racimos de solapados y, dentro de cada racimo, meter cada
 * bloque en la primera columna que ya quedó libre.
 *
 * El ancho lo decide el racimo y no el día entero: si a las 9 hay tres cosas
 * en paralelo pero a las 21 hay una sola, la de las 21 ocupa todo el ancho en
 * vez de quedar flaquita al costado por culpa de la mañana.
 */
export function assignLanes(
  items: { startMinutes: number; endMinutes: number }[],
): { lane: number; laneCount: number }[] {
  const order = items
    .map((item, index) => ({ ...item, index }))
    .sort((a, b) => a.startMinutes - b.startMinutes || a.endMinutes - b.endMinutes);

  const result: { lane: number; laneCount: number }[] = items.map(() => ({
    lane: 0,
    laneCount: 1,
  }));

  let cluster: typeof order = [];
  let clusterEnd = -1;

  function flush() {
    if (cluster.length === 0) return;

    // Fin de cada columna dentro del racimo.
    const laneEnds: number[] = [];
    for (const item of cluster) {
      let lane = laneEnds.findIndex((end) => end <= item.startMinutes);
      if (lane === -1) {
        lane = laneEnds.length;
        laneEnds.push(item.endMinutes);
      } else {
        laneEnds[lane] = item.endMinutes;
      }
      result[item.index].lane = lane;
    }

    for (const item of cluster) result[item.index].laneCount = laneEnds.length;
    cluster = [];
    clusterEnd = -1;
  }

  for (const item of order) {
    if (cluster.length > 0 && item.startMinutes >= clusterEnd) flush();
    cluster.push(item);
    clusterEnd = Math.max(clusterEnd, item.endMinutes);
  }
  flush();

  return result;
}

/** Los bloques de esa fecha, ordenados y ya repartidos en columnas. */
export function blocksForDate(blocks: TimeBlockRow[], date: IsoDate): DayBlock[] {
  const applicable = blocks
    .filter((block) => blockAppliesOn(block, date))
    .map((block) => ({
      block,
      startMinutes: minutesFromTime(block.starts_at),
      endMinutes: minutesFromTime(block.ends_at),
    }))
    .sort(
      (a, b) =>
        a.startMinutes - b.startMinutes ||
        a.endMinutes - b.endMinutes ||
        a.block.title.localeCompare(b.block.title, "es"),
    );

  const lanes = assignLanes(applicable);
  return applicable.map((item, index) => ({ ...item, ...lanes[index] }));
}

/**
 * El rango de horas que hay que dibujar.
 *
 * Arranca a las 7 y termina a las 23 aunque no haya nada: un día que empieza a
 * las 14 porque el primer bloque es a las 14 se lee como si la mañana no
 * existiera. Si algo cae fuera de esa ventana, la ventana se agranda hasta
 * cubrirlo.
 */
export function timelineRange(
  blocks: DayBlock[],
  { defaultFrom = 7, defaultTo = 23 } = {},
): { fromHour: number; toHour: number } {
  let fromHour = defaultFrom;
  let toHour = defaultTo;

  for (const { startMinutes, endMinutes } of blocks) {
    fromHour = Math.min(fromHour, Math.floor(startMinutes / 60));
    toHour = Math.max(toHour, Math.ceil(endMinutes / 60));
  }

  return { fromHour: Math.max(0, fromHour), toHour: Math.min(24, Math.max(toHour, fromHour + 1)) };
}

/** El bloque en curso a esa hora, si hay alguno. Con solapados, el que termina antes. */
export function currentBlock(blocks: DayBlock[], atMinutes: number): DayBlock | null {
  const active = blocks.filter(
    (b) => atMinutes >= b.startMinutes && atMinutes < b.endMinutes,
  );
  if (active.length === 0) return null;
  return active.reduce((soonest, b) => (b.endMinutes < soonest.endMinutes ? b : soonest));
}

export function nextBlock(blocks: DayBlock[], atMinutes: number): DayBlock | null {
  return blocks.find((b) => b.startMinutes > atMinutes) ?? null;
}

/** "en 20 min", "en 2 h 15", "arrancó hace 10 min". */
export function untilLabel(minutesFromNow: number): string {
  const abs = Math.abs(minutesFromNow);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  const amount = h === 0 ? `${m} min` : m === 0 ? `${h} h` : `${h} h ${m}`;
  return minutesFromNow >= 0 ? `en ${amount}` : `hace ${amount}`;
}
