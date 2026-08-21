"use client";

import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { MemberAvatar } from "@/components/app/member-chip";
import { EmptyState } from "@/components/ui/card";
import { formatMoney } from "@/lib/money";
import { createClient } from "@/lib/supabase/client";
import type { FamilyMemberRow, IncomeEntryRow } from "@/types/database";

export function IncomeList({
  incomes,
  members,
  totalCents,
  onChanged,
}: {
  incomes: IncomeEntryRow[];
  members: FamilyMemberRow[];
  totalCents: number;
  onChanged: () => void;
}) {
  const byId = new Map(members.map((m) => [m.id, m]));

  async function remove(id: string) {
    const { error } = await createClient().from("income_entries").delete().eq("id", id);
    if (error) {
      toast.error("No se pudo borrar.");
      return;
    }
    onChanged();
  }

  if (incomes.length === 0) {
    return (
      <EmptyState
        title="Sin ingresos cargados este mes"
        hint="Cargá lo que entra para que el reparto tenga sobre qué calcular."
      />
    );
  }

  // Cuánto aporta cada uno. Es un dato que la pareja mira, no para fiscalizar
  // sino porque el fondo común sale de la suma.
  const perMember = new Map<string, number>();
  for (const income of incomes) {
    const key = income.member_id ?? "_sin_asignar";
    perMember.set(key, (perMember.get(key) ?? 0) + income.amount_cents);
  }

  return (
    <div className="space-y-3">
      <div className="rounded-app bg-surface shadow-card p-3">
        <p className="text-xs text-muted">Total del mes</p>
        <p className="text-2xl font-bold text-fg">{formatMoney(totalCents)}</p>

        <ul className="mt-2 space-y-1">
          {[...perMember].map(([key, amount]) => {
            const member = key === "_sin_asignar" ? undefined : byId.get(key);
            return (
              <li key={key} className="flex items-center gap-2 text-sm">
                {member ? (
                  <>
                    <MemberAvatar member={member} size="sm" />
                    <span className="text-muted">{member.display_name}</span>
                  </>
                ) : (
                  <span className="text-muted">Sin asignar</span>
                )}
                <span className="ml-auto text-fg">{formatMoney(amount)}</span>
              </li>
            );
          })}
        </ul>
      </div>

      <ul className="divide-y divide-border overflow-hidden rounded-app bg-surface shadow-card">
        {incomes.map((income) => {
          const member = income.member_id ? byId.get(income.member_id) : undefined;

          return (
            <li key={income.id} className="flex items-center gap-3 p-3">
              {member ? (
                <MemberAvatar member={member} />
              ) : (
                <span
                  aria-hidden
                  className="grid size-8 shrink-0 place-items-center rounded-full border border-dashed border-border-strong text-xs text-muted"
                >
                  ?
                </span>
              )}

              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-fg">
                  {income.label}
                </span>
                {income.received_on ? (
                  <span className="block text-xs text-muted">
                    Cobrado el {income.received_on}
                  </span>
                ) : null}
              </span>

              <span className="shrink-0 text-sm font-semibold text-fg">
                {formatMoney(income.amount_cents)}
              </span>

              <button
                type="button"
                onClick={() => remove(income.id)}
                aria-label={`Borrar ${income.label}`}
                className="grid size-9 shrink-0 place-items-center rounded-full text-muted/40 hover:text-danger"
              >
                <Trash2 className="size-4" />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
