"use client";

import { Check, Repeat2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { MemberAvatar } from "@/components/app/member-chip";
import { EmptyState } from "@/components/ui/card";
import { expenseStatus, type ExpenseStatus } from "@/lib/budget/allocate";
import { categoryLabel } from "@/lib/budget/queries";
import { relativeDayLabel } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { BudgetAllocationRow, ExpenseRow, FamilyMemberRow } from "@/types/database";

const STATUS_STYLE: Record<ExpenseStatus, { label: string; className: string }> = {
  pagado: { label: "Pagado", className: "text-success" },
  vencido: { label: "Vencido", className: "text-danger font-semibold" },
  "por-vencer": { label: "Por vencer", className: "text-warning font-semibold" },
  pendiente: { label: "", className: "text-muted" },
};

export function ExpenseList({
  expenses,
  allocations,
  members,
  today,
  onChanged,
}: {
  expenses: ExpenseRow[];
  allocations: BudgetAllocationRow[];
  members: FamilyMemberRow[];
  today: string;
  onChanged: () => void;
}) {
  const byMember = new Map(members.map((m) => [m.id, m]));
  const byAllocation = new Map(allocations.map((a) => [a.id, a]));

  async function togglePaid(expense: ExpenseRow) {
    // `paid_on` es la fuente de verdad del estado; no hay columna `status`
    // que pueda quedar desincronizada. Quién pagó lo sella un trigger.
    const { error } = await createClient()
      .from("expenses")
      .update({ paid_on: expense.paid_on ? null : today })
      .eq("id", expense.id);

    if (error) {
      toast.error("No se pudo actualizar.");
      return;
    }
    onChanged();
  }

  async function remove(expense: ExpenseRow) {
    const { error } = await createClient().from("expenses").delete().eq("id", expense.id);
    if (error) {
      toast.error("No se pudo borrar.");
      return;
    }
    onChanged();
  }

  if (expenses.length === 0) {
    return (
      <EmptyState
        title="Sin vencimientos este mes"
        hint="Cargá el alquiler, los servicios y las tarjetas para verlos ordenados por fecha."
      />
    );
  }

  return (
    <ul className="divide-y divide-border overflow-hidden rounded-app bg-surface shadow-card">
      {expenses.map((expense) => {
        const status = expenseStatus(expense, today);
        const style = STATUS_STYLE[status];
        const payer = expense.paid_by_member_id
          ? byMember.get(expense.paid_by_member_id)
          : undefined;
        const allocation = expense.allocation_id
          ? byAllocation.get(expense.allocation_id)
          : undefined;

        return (
          <li key={expense.id} className="flex items-center gap-2 pr-2">
            <button
              type="button"
              onClick={() => togglePaid(expense)}
              role="checkbox"
              aria-checked={status === "pagado"}
              aria-label={`Marcar ${expense.label} como ${
                status === "pagado" ? "impago" : "pagado"
              }`}
              className="grid size-11 shrink-0 place-items-center"
            >
              <span
                className={cn(
                  "grid size-6 place-items-center rounded-md border-2 transition-colors",
                  status === "pagado"
                    ? "border-success bg-success text-white"
                    : status === "vencido"
                      ? "border-danger"
                      : "border-border",
                )}
              >
                {status === "pagado" ? <Check className="size-4 stroke-[3]" /> : null}
              </span>
            </button>

            <div className="min-w-0 flex-1 py-3">
              <div className="flex items-baseline justify-between gap-2">
                <span
                  className={cn(
                    "min-w-0 truncate text-sm font-medium",
                    status === "pagado" ? "text-muted line-through" : "text-fg",
                  )}
                >
                  {expense.label}
                </span>
                <span
                  className={cn(
                    "shrink-0 text-sm font-semibold",
                    status === "pagado" ? "text-muted" : "text-fg",
                  )}
                >
                  {formatMoney(expense.amount_cents)}
                </span>
              </div>

              <div className="flex items-center gap-1.5 text-xs text-muted">
                <span className={style.className}>
                  {style.label || relativeDayLabel(expense.due_date, today)}
                </span>
                {style.label ? <span>· {expense.due_date}</span> : null}
                <span>· {categoryLabel(expense.category)}</span>
                {allocation ? (
                  <span
                    className="truncate"
                    style={{ color: allocation.color }}
                    title={`Imputado a ${allocation.label}`}
                  >
                    · {allocation.label}
                  </span>
                ) : null}
                {expense.is_recurring ? <Repeat2 className="size-3 shrink-0" /> : null}
                {payer ? <MemberAvatar member={payer} size="sm" className="ml-auto" /> : null}
              </div>
            </div>

            <button
              type="button"
              onClick={() => remove(expense)}
              aria-label={`Borrar ${expense.label}`}
              className="grid size-9 shrink-0 place-items-center rounded-full text-muted/40 hover:text-danger"
            >
              <Trash2 className="size-4" />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
