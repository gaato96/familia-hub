import { splitByBasisPoints, sumCents } from "@/lib/money";
import type { BudgetAllocationRow, ExpenseRow, IncomeEntryRow } from "@/types/database";

/**
 * Motor de presupuesto. Funciones puras, sin red y sin fechas implícitas:
 * la pantalla las recalcula en vivo mientras alguien arrastra un porcentaje.
 *
 * Todo entra y sale en centavos enteros y basis points enteros. Ver
 * src/lib/money.ts para el porqué.
 */

export const FULL_BP = 10_000;

export type AllocationSlice = {
  allocation: BudgetAllocationRow;
  /** Lo que le toca de los ingresos del mes. */
  budgetCents: number;
  /** Lo ya imputado a este rubro (gastos con `allocation_id`). */
  spentCents: number;
  /** Positivo = queda; negativo = se pasó. */
  remainingCents: number;
};

export type BudgetSummary = {
  incomeCents: number;
  slices: AllocationSlice[];
  /** Suma de los porcentajes. 10000 = repartido exacto. */
  totalBp: number;
  /** Lo que falta repartir. Negativo = está sobreasignado. */
  unassignedBp: number;
  /**
   * Plata sin rubro asignado. Solo existe si los porcentajes no suman 100%:
   * repartir 10000 bp no deja resto (`splitByBasisPoints` entrega hasta el
   * último centavo).
   */
  unassignedCents: number;
};

/**
 * Reparte los ingresos del mes entre los rubros.
 *
 * El reparto usa `splitByBasisPoints`, que entrega los centavos sobrantes a
 * las partes con mayor resto fraccionario. Sin eso, seis rubros sobre un
 * ingreso que no divide exacto suman uno o dos centavos menos que el total y
 * la pantalla muestra una diferencia que nadie puede explicar.
 */
export function summarizeBudget({
  incomes,
  allocations,
  expenses,
}: {
  incomes: IncomeEntryRow[];
  allocations: BudgetAllocationRow[];
  expenses: ExpenseRow[];
}): BudgetSummary {
  const incomeCents = sumCents(incomes.map((i) => i.amount_cents));
  const totalBp = allocations.reduce((sum, a) => sum + a.percent_bp, 0);

  // Se reparte sobre FULL_BP y no sobre `totalBp`: si los porcentajes suman
  // 90%, el 10% restante tiene que quedar VISIBLE como sin asignar, no
  // inflarse repartiéndose entre los rubros existentes. Es la diferencia
  // entre "te falta asignar plata" y "la plata se fue sola a algún lado".
  const weights = [...allocations.map((a) => a.percent_bp), Math.max(0, FULL_BP - totalBp)];
  const amounts = splitByBasisPoints(incomeCents, weights);

  const spentByAllocation = new Map<string, number>();
  for (const expense of expenses) {
    if (!expense.allocation_id) continue;
    spentByAllocation.set(
      expense.allocation_id,
      (spentByAllocation.get(expense.allocation_id) ?? 0) + expense.amount_cents,
    );
  }

  const slices = allocations.map((allocation, index) => {
    const budgetCents = amounts[index] ?? 0;
    const spentCents = spentByAllocation.get(allocation.id) ?? 0;

    return {
      allocation,
      budgetCents,
      spentCents,
      remainingCents: budgetCents - spentCents,
    };
  });

  return {
    incomeCents,
    slices,
    totalBp,
    unassignedBp: FULL_BP - totalBp,
    unassignedCents: amounts[allocations.length] ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Estado de un vencimiento
// ---------------------------------------------------------------------------
export type ExpenseStatus = "pagado" | "vencido" | "por-vencer" | "pendiente";

/** Días antes del vencimiento en los que un gasto pasa a "por vencer". */
const SOON_DAYS = 5;

/**
 * El estado se DERIVA de `paid_on` y de la fecha; no hay columna `status`.
 *
 * Una columna editable a mano dejaría filas "pagadas" sin fecha de pago, o
 * "pendientes" con fecha — dos fuentes de verdad para el mismo hecho.
 */
export function expenseStatus(expense: ExpenseRow, today: string): ExpenseStatus {
  if (expense.paid_on) return "pagado";
  if (expense.due_date < today) return "vencido";

  const daysLeft = Math.round(
    (Date.parse(`${expense.due_date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) /
      86_400_000,
  );

  return daysLeft <= SOON_DAYS ? "por-vencer" : "pendiente";
}

export type ExpenseTotals = {
  pendingCents: number;
  overdueCents: number;
  paidCents: number;
};

export function totalsFor(expenses: ExpenseRow[], today: string): ExpenseTotals {
  let pendingCents = 0;
  let overdueCents = 0;
  let paidCents = 0;

  for (const expense of expenses) {
    const status = expenseStatus(expense, today);
    if (status === "pagado") paidCents += expense.amount_cents;
    else if (status === "vencido") overdueCents += expense.amount_cents;
    else pendingCents += expense.amount_cents;
  }

  return { pendingCents, overdueCents, paidCents };
}

/**
 * "35%", "7,5%". Los basis points nunca se muestran crudos.
 *
 * Se usa Intl y no `toFixed(2)`: este último siempre devuelve dos decimales,
 * así que 750 bp salía como "7,50%" — correcto pero no es como lo escribiría
 * nadie. `maximumFractionDigits` recorta el cero de más y de paso deja la coma
 * decimal argentina sin reemplazos a mano.
 */
export function formatBp(bp: number): string {
  const formatted = new Intl.NumberFormat("es-AR", {
    maximumFractionDigits: 2,
  }).format(bp / 100);

  return `${formatted}%`;
}

/** Lo que se tipea en un campo de porcentaje, a basis points enteros. */
export function parsePercentToBp(input: string): number | null {
  const cleaned = input.trim().replace("%", "").replace(",", ".");
  if (cleaned === "") return null;

  const value = Number(cleaned);
  if (!Number.isFinite(value) || value < 0 || value > 100) return null;

  return Math.round(value * 100);
}
