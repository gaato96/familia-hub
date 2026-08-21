import { todayInAr, type IsoDate } from "@/lib/dates";
import type { GoalCategory, GoalRow, GoalStepRow } from "@/types/database";

/**
 * Objetivos: lo que la casa se propuso, partido en pasos que alguien puede
 * agarrar.
 *
 * Todo lo de acá es cálculo puro sobre filas ya leídas. El avance NO se guarda
 * en una columna: se cuenta desde los pasos en cada render. Una columna
 * `progress` es una que se desactualiza el día que alguien borra un paso
 * tildado desde otra pantalla.
 */

export const GOAL_CATEGORIES: { value: GoalCategory; label: string }[] = [
  { value: "casa", label: "La casa" },
  { value: "familia", label: "Familia" },
  { value: "salud", label: "Salud" },
  { value: "plata", label: "Plata" },
  { value: "estudio", label: "Estudio" },
  { value: "proyecto", label: "Proyecto" },
];

export function goalCategoryLabel(category: GoalCategory): string {
  return GOAL_CATEGORIES.find((c) => c.value === category)?.label ?? "La casa";
}

export type GoalWithSteps = GoalRow & { steps: GoalStepRow[] };

export type GoalProgress = {
  done: number;
  total: number;
  /** 0 a 1. Un objetivo sin pasos vale 0, salvo que esté dado por logrado. */
  ratio: number;
};

export function goalProgress(goal: GoalWithSteps): GoalProgress {
  const total = goal.steps.length;
  const done = goal.steps.filter((step) => step.done_at !== null).length;

  // Sin pasos no hay fracción posible. Devolver 0 y no NaN importa: NaN se
  // propaga a un `width: NaN%` y la barra desaparece sin error.
  if (total === 0) return { done: 0, total: 0, ratio: goal.status === "logrado" ? 1 : 0 };

  return { done, total, ratio: done / total };
}

/**
 * Cuán encima está la fecha. Solo mira objetivos activos: un objetivo logrado
 * con fecha pasada no está "vencido", está hecho.
 */
export type GoalUrgency = "vencido" | "hoy" | "esta-semana" | null;

export function goalUrgency(
  goal: Pick<GoalRow, "status" | "target_date">,
  today: IsoDate = todayInAr(),
): GoalUrgency {
  if (goal.status !== "activo" || goal.target_date === null) return null;
  if (goal.target_date < today) return "vencido";
  if (goal.target_date === today) return "hoy";

  const days = Math.round(
    (Date.parse(`${goal.target_date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) /
      86_400_000,
  );
  return days <= 7 ? "esta-semana" : null;
}

/**
 * Orden de la lista.
 *
 * Primero lo activo, después lo pausado, y al final lo logrado — que se deja
 * a la vista a propósito en vez de esconderlo: ver lo que la casa consiguió es
 * la mitad de lo que hace que alguien vuelva a esta pantalla.
 *
 * Dentro de los activos manda la fecha, y lo que no tiene fecha va después:
 * un objetivo con plazo es un compromiso, uno sin plazo es una intención.
 */
const STATUS_ORDER = { activo: 0, pausado: 1, logrado: 2, archivado: 3 } as const;

export function sortGoals(goals: GoalWithSteps[]): GoalWithSteps[] {
  return [...goals].sort((a, b) => {
    const byStatus = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
    if (byStatus !== 0) return byStatus;

    if (a.target_date !== b.target_date) {
      if (a.target_date === null) return 1;
      if (b.target_date === null) return -1;
      return a.target_date.localeCompare(b.target_date);
    }

    return a.position - b.position || a.title.localeCompare(b.title, "es");
  });
}

/** Los números del encabezado y de la tarjeta del panel. */
export function summarizeGoals(goals: GoalWithSteps[]) {
  const active = goals.filter((g) => g.status === "activo");
  const steps = active.flatMap((g) => g.steps);
  const doneSteps = steps.filter((s) => s.done_at !== null).length;

  return {
    active: active.length,
    achieved: goals.filter((g) => g.status === "logrado").length,
    steps: steps.length,
    doneSteps,
    /** Avance de la casa sobre TODOS los pasos activos, no promedio de objetivos:
        un objetivo de un paso no puede pesar lo mismo que uno de veinte. */
    ratio: steps.length === 0 ? 0 : doneSteps / steps.length,
  };
}

/** Los pasos sin tildar que le tocan a alguien, ordenados por fecha. */
export function openStepsFor(goals: GoalWithSteps[], memberId: string): GoalStepRow[] {
  return goals
    .filter((goal) => goal.status === "activo")
    .flatMap((goal) => goal.steps)
    .filter((step) => step.done_at === null && step.assigned_member_id === memberId)
    .sort((a, b) => {
      if (a.due_date !== b.due_date) {
        if (a.due_date === null) return 1;
        if (b.due_date === null) return -1;
        return a.due_date.localeCompare(b.due_date);
      }
      return a.position - b.position;
    });
}
