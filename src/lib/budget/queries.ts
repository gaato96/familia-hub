import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  BudgetAllocationRow,
  Database,
  ExpenseCategory,
  ExpenseRow,
  IncomeEntryRow,
} from "@/types/database";

/**
 * Lecturas de finanzas. Como en el resto de la app, ninguna filtra por
 * family_id: lo hace RLS, que además exige `is_parent()` en estas tres tablas.
 */

/** El primer día del mes al que pertenece una fecha. */
export function monthOf(date: string): string {
  return `${date.slice(0, 7)}-01`;
}

export function addMonths(month: string, delta: number): string {
  const [year, monthIndex] = month.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, monthIndex - 1 + delta, 1));
  return shifted.toISOString().slice(0, 10);
}

export function formatMonth(month: string): string {
  return new Intl.DateTimeFormat("es-AR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(Date.parse(`${month}T12:00:00Z`));
}

export type MonthFinances = {
  incomes: IncomeEntryRow[];
  allocations: BudgetAllocationRow[];
  expenses: ExpenseRow[];
};

export async function fetchMonthFinances(
  supabase: SupabaseClient<Database>,
  month: string,
): Promise<MonthFinances> {
  const nextMonth = addMonths(month, 1);

  const [incomes, allocations, expenses] = await Promise.all([
    supabase
      .from("income_entries")
      .select("*")
      .eq("period_month", month)
      .order("created_at", { ascending: true }),
    supabase.from("budget_allocations").select("*").order("position", { ascending: true }),
    supabase
      .from("expenses")
      .select("*")
      // Por vencimiento: la pregunta del módulo es "qué hay que pagar", no
      // "en qué gastamos". El orden de la query ES la vista principal.
      .gte("due_date", month)
      .lt("due_date", nextMonth)
      .order("due_date", { ascending: true }),
  ]);

  return {
    incomes: incomes.data ?? [],
    allocations: allocations.data ?? [],
    expenses: expenses.data ?? [],
  };
}

/**
 * Vencimientos impagos de meses anteriores.
 *
 * Van aparte del mes en curso a propósito: una factura de agosto sin pagar no
 * puede desaparecer de la vista solo porque ya estamos en septiembre. Es
 * justamente lo que hay que pagar primero.
 */
export async function fetchOverdueExpenses(
  supabase: SupabaseClient<Database>,
  month: string,
): Promise<ExpenseRow[]> {
  const { data } = await supabase
    .from("expenses")
    .select("*")
    .lt("due_date", month)
    .is("paid_on", null)
    .order("due_date", { ascending: true });

  return data ?? [];
}

export const EXPENSE_CATEGORIES: { value: ExpenseCategory; label: string }[] = [
  { value: "alquiler", label: "Alquiler" },
  { value: "expensas", label: "Expensas" },
  { value: "servicios", label: "Servicios" },
  { value: "tarjeta", label: "Tarjeta" },
  { value: "prestamo", label: "Préstamo" },
  { value: "salud", label: "Salud" },
  { value: "julian", label: "Julián" },
  { value: "super", label: "Súper" },
  { value: "transporte", label: "Transporte" },
  { value: "suscripcion", label: "Suscripción" },
  { value: "varios", label: "Varios" },
];

export function categoryLabel(category: ExpenseCategory): string {
  return EXPENSE_CATEGORIES.find((c) => c.value === category)?.label ?? category;
}
