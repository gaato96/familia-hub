import { FinancesView } from "@/components/finanzas/finances-view";
import { requireParent } from "@/lib/auth/context";
import { fetchMonthFinances, fetchOverdueExpenses, monthOf } from "@/lib/budget/queries";
import { todayInAr } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Finanzas" };

/**
 * Finanzas del hogar. Solo adultos, como el expediente.
 *
 * El mes se elige por la URL (`?mes=YYYY-MM-01`) y no por estado de cliente:
 * el botón "atrás" del teléfono vuelve al mes anterior en vez de salir de la
 * pantalla, y el link se puede compartir.
 */
export default async function FinanzasPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  const { mes } = await searchParams;
  const { members, member } = await requireParent();

  const today = todayInAr();
  const month = isMonth(mes) ? mes : monthOf(today);

  const supabase = await createClient();
  const [finances, overdue] = await Promise.all([
    fetchMonthFinances(supabase, month),
    fetchOverdueExpenses(supabase, month),
  ]);

  return (
    <FinancesView
      month={month}
      today={today}
      finances={finances}
      overdue={overdue}
      members={members}
      currentMemberId={member.id}
    />
  );
}

function isMonth(value: string | undefined): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-01$/.test(value);
}
