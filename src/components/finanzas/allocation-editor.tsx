"use client";

import { Lock, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { MemberAvatar } from "@/components/app/member-chip";
import { Input } from "@/components/ui/input";
import {
  formatBp,
  parsePercentToBp,
  type BudgetSummary,
} from "@/lib/budget/allocate";
import { formatMoney } from "@/lib/money";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { FamilyMemberRow } from "@/types/database";

/**
 * Reparto del fondo común.
 *
 * La suma NO está forzada por un constraint en la base: bajar un rubro del 35%
 * al 30% dejaría el total en 95% y la base rechazaría el guardado antes de
 * poder subir otro. Se valida acá, mostrando cuánto falta o cuánto sobra
 * mientras se edita — que además es la información que uno quiere ver.
 */
export function AllocationEditor({
  summary,
  members,
  onChanged,
}: {
  summary: BudgetSummary;
  members: FamilyMemberRow[];
  onChanged: () => void;
}) {
  const byId = new Map(members.map((m) => [m.id, m]));
  const [saving, setSaving] = useState<string | null>(null);

  async function updatePercent(id: string, raw: string) {
    const bp = parsePercentToBp(raw);
    if (bp === null) {
      toast.error("Poné un porcentaje entre 0 y 100.");
      return;
    }

    setSaving(id);
    const { error } = await createClient()
      .from("budget_allocations")
      .update({ percent_bp: bp })
      .eq("id", id);
    setSaving(null);

    if (error) {
      toast.error("No se pudo guardar.");
      return;
    }
    onChanged();
  }

  async function remove(id: string) {
    const { error } = await createClient().from("budget_allocations").delete().eq("id", id);
    if (error) {
      toast.error("No se pudo borrar.");
      return;
    }
    onChanged();
  }

  const isBalanced = summary.unassignedBp === 0;

  return (
    <div className="space-y-3">
      <div
        className={cn(
          "rounded-app border p-3 text-sm",
          isBalanced
            ? "border-success/40 bg-success/5 text-fg"
            : "border-warning/40 bg-warning/10 text-fg",
        )}
      >
        {isBalanced ? (
          <p>
            Repartido al 100%:{" "}
            <span className="font-semibold">{formatMoney(summary.incomeCents)}</span>.
          </p>
        ) : summary.unassignedBp > 0 ? (
          <p>
            Falta asignar <span className="font-semibold">{formatBp(summary.unassignedBp)}</span>{" "}
            — {formatMoney(summary.unassignedCents)} sin destino.
          </p>
        ) : (
          <p>
            Te pasaste{" "}
            <span className="font-semibold">{formatBp(-summary.unassignedBp)}</span>. Los rubros
            suman más del 100% de lo que entra.
          </p>
        )}
      </div>

      <ul className="space-y-2">
        {summary.slices.map(({ allocation, budgetCents, spentCents, remainingCents }) => {
          const owner = allocation.member_id ? byId.get(allocation.member_id) : undefined;
          const overspent = remainingCents < 0;

          return (
            <li
              key={allocation.id}
              className="rounded-app bg-surface shadow-card p-3"
              style={{ borderLeftWidth: 4, borderLeftColor: allocation.color }}
            >
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-fg">
                  {allocation.label}
                </span>

                {owner ? (
                  <span
                    className="flex shrink-0 items-center gap-1 text-xs text-muted"
                    title="Asignación personal: la app no pide detalle de estos gastos"
                  >
                    <Lock className="size-3" />
                    <MemberAvatar member={owner} size="sm" />
                  </span>
                ) : null}

                <Input
                  defaultValue={String(allocation.percent_bp / 100)}
                  inputMode="decimal"
                  aria-label={`Porcentaje de ${allocation.label}`}
                  disabled={saving === allocation.id}
                  onBlur={(e) => {
                    const next = parsePercentToBp(e.target.value);
                    if (next !== null && next !== allocation.percent_bp) {
                      void updatePercent(allocation.id, e.target.value);
                    }
                  }}
                  className="h-9 w-16 shrink-0 text-center"
                />

                <button
                  type="button"
                  onClick={() => remove(allocation.id)}
                  aria-label={`Borrar ${allocation.label}`}
                  className="grid size-8 shrink-0 place-items-center rounded-full text-muted/40 hover:text-danger"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>

              <div className="mt-2 flex items-baseline justify-between gap-2 text-xs">
                <span className="font-semibold text-fg">{formatMoney(budgetCents)}</span>
                {/* Las asignaciones personales son de libre disponibilidad: no
                    tiene sentido mostrarles "gastado" ni "queda". */}
                {owner ? (
                  <span className="text-muted">libre disponibilidad</span>
                ) : (
                  <span className={overspent ? "text-danger" : "text-muted"}>
                    {formatMoney(spentCents)} usado ·{" "}
                    {overspent
                      ? `${formatMoney(-remainingCents)} de más`
                      : `${formatMoney(remainingCents)} queda`}
                  </span>
                )}
              </div>

              {!owner && budgetCents > 0 ? (
                <div
                  className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-2"
                  role="presentation"
                >
                  <div
                    className={cn("h-full rounded-full", overspent ? "bg-danger" : "bg-success")}
                    style={{
                      width: `${Math.min(100, (spentCents / budgetCents) * 100)}%`,
                    }}
                  />
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
