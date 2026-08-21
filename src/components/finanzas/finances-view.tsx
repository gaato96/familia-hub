"use client";

import { ChevronLeft, ChevronRight, Plus, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { AllocationEditor } from "@/components/finanzas/allocation-editor";
import { ExpenseList } from "@/components/finanzas/expense-list";
import { FinanceComposer } from "@/components/finanzas/finance-composer";
import { IncomeList } from "@/components/finanzas/income-list";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { summarizeBudget, totalsFor } from "@/lib/budget/allocate";
import { addMonths, formatMonth, type MonthFinances } from "@/lib/budget/queries";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { ExpenseRow, FamilyMemberRow } from "@/types/database";

type Tab = "vencimientos" | "reparto" | "ingresos";

export function FinancesView({
  month,
  today,
  finances,
  overdue,
  members,
  currentMemberId,
}: {
  month: string;
  today: string;
  finances: MonthFinances;
  overdue: ExpenseRow[];
  members: FamilyMemberRow[];
  currentMemberId: string;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("vencimientos");
  const [composerOpen, setComposerOpen] = useState(false);

  const summary = summarizeBudget(finances);
  const totals = totalsFor(finances.expenses, today);
  const overdueTotals = totalsFor(overdue, today);

  const refresh = () => router.refresh();

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between gap-2">
        <Link
          href={`/finanzas?mes=${addMonths(month, -1)}`}
          aria-label="Mes anterior"
          className="grid size-10 place-items-center rounded-full text-muted hover:bg-surface-2"
        >
          <ChevronLeft className="size-5" />
        </Link>
        <h1 className="text-lg font-bold capitalize text-fg">{formatMonth(month)}</h1>
        <Link
          href={`/finanzas?mes=${addMonths(month, 1)}`}
          aria-label="Mes siguiente"
          className="grid size-10 place-items-center rounded-full text-muted hover:bg-surface-2"
        >
          <ChevronRight className="size-5" />
        </Link>
      </header>

      {/* Los tres números que se miran primero. Lo vencido va en rojo aunque
          sea cero: que el lugar esté siempre ocupado hace que se note cuando
          deja de ser cero. */}
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Ingresos" value={formatMoney(summary.incomeCents)} />
        <Stat label="Por pagar" value={formatMoney(totals.pendingCents)} />
        <Stat
          label="Vencido"
          value={formatMoney(totals.overdueCents + overdueTotals.overdueCents)}
          tone={totals.overdueCents + overdueTotals.overdueCents > 0 ? "danger" : undefined}
        />
      </div>

      {overdue.length > 0 ? (
        <section className="rounded-app border border-danger/40 bg-danger/5 p-3">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-danger">
            <TriangleAlert className="size-4" />
            De meses anteriores, sin pagar
          </h2>
          {/* Arrastrar lo impago del mes pasado a la vista de este mes es el
              punto entero de ordenar por vencimiento. */}
          <ul className="mt-2 space-y-1">
            {overdue.map((expense) => (
              <li key={expense.id} className="flex justify-between gap-2 text-sm">
                <span className="min-w-0 truncate text-fg">{expense.label}</span>
                <span className="shrink-0 text-muted">
                  {expense.due_date} · {formatMoney(expense.amount_cents)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
        {(
          [
            { value: "vencimientos", label: "Vencimientos" },
            { value: "reparto", label: "Reparto" },
            { value: "ingresos", label: "Ingresos" },
          ] as const
        ).map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setTab(t.value)}
            aria-pressed={tab === t.value}
            className={cn(
              "shrink-0 rounded-full border px-3.5 py-2 text-sm font-medium",
              tab === t.value
                ? "border-primary bg-primary text-primary-fg"
                : "border-border bg-surface text-muted",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "vencimientos" ? (
        <ExpenseList
          expenses={finances.expenses}
          allocations={finances.allocations}
          members={members}
          today={today}
          onChanged={refresh}
        />
      ) : null}

      {tab === "reparto" ? (
        <AllocationEditor summary={summary} members={members} onChanged={refresh} />
      ) : null}

      {tab === "ingresos" ? (
        <IncomeList
          incomes={finances.incomes}
          members={members}
          totalCents={summary.incomeCents}
          onChanged={refresh}
        />
      ) : null}

      <Button size="lg" className="w-full" onClick={() => setComposerOpen(true)}>
        <Plus /> Agregar
      </Button>

      <Sheet open={composerOpen} onOpenChange={setComposerOpen}>
        <SheetContent title="Agregar a finanzas">
          <FinanceComposer
            month={month}
            today={today}
            allocations={finances.allocations}
            members={members}
            currentMemberId={currentMemberId}
            onDone={() => {
              setComposerOpen(false);
              refresh();
            }}
          />
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "danger";
}) {
  return (
    <div className="rounded-app bg-surface shadow-card p-3">
      <p className="text-xs text-muted">{label}</p>
      <p
        className={cn(
          "truncate text-base font-bold",
          tone === "danger" ? "text-danger" : "text-fg",
        )}
      >
        {value}
      </p>
    </div>
  );
}
