"use client";

import { useState } from "react";
import { toast } from "sonner";

import { MemberAvatar } from "@/components/app/member-chip";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { EXPENSE_CATEGORIES } from "@/lib/budget/queries";
import { formatMoney, parseMoneyToCents } from "@/lib/money";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type {
  BudgetAllocationRow,
  ExpenseCategory,
  FamilyMemberRow,
} from "@/types/database";

type Tab = "gasto" | "ingreso" | "rubro";

export function FinanceComposer({
  month,
  today,
  allocations,
  members,
  currentMemberId,
  onDone,
}: {
  month: string;
  today: string;
  allocations: BudgetAllocationRow[];
  members: FamilyMemberRow[];
  currentMemberId: string;
  onDone: () => void;
}) {
  const [tab, setTab] = useState<Tab>("gasto");

  return (
    <div className="space-y-4">
      <div
        role="tablist"
        aria-label="Qué agregar"
        className="grid grid-cols-3 gap-1 rounded-app bg-surface-2 p-1"
      >
        {(["gasto", "ingreso", "rubro"] as const).map((value) => (
          <button
            key={value}
            role="tab"
            type="button"
            aria-selected={tab === value}
            onClick={() => setTab(value)}
            className={cn(
              "rounded-[calc(var(--radius)-0.25rem)] py-2.5 text-sm capitalize",
              tab === value
                ? "bg-surface font-semibold text-fg shadow-sm"
                : "font-medium text-muted",
            )}
          >
            {value}
          </button>
        ))}
      </div>

      {tab === "gasto" ? (
        <ExpenseForm
          today={today}
          month={month}
          allocations={allocations}
          onDone={onDone}
        />
      ) : null}
      {tab === "ingreso" ? (
        <IncomeForm
          month={month}
          today={today}
          members={members}
          currentMemberId={currentMemberId}
          onDone={onDone}
        />
      ) : null}
      {tab === "rubro" ? <AllocationForm members={members} onDone={onDone} /> : null}
    </div>
  );
}

/** Campo de plata compartido: muestra en vivo cómo se va a guardar. */
function MoneyField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const cents = parseMoneyToCents(value);

  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        required
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="450000"
      />
      {/* El eco existe porque "450.000" y "450,00" se tipean parecido y
          significan cosas muy distintas. */}
      {cents !== null ? (
        <p className="mt-1 text-xs text-muted">Se guarda como {formatMoney(cents)}</p>
      ) : null}
    </div>
  );
}

function ExpenseForm({
  today,
  month,
  allocations,
  onDone,
}: {
  today: string;
  month: string;
  allocations: BudgetAllocationRow[];
  onDone: () => void;
}) {
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  // Por defecto vence en el mes que se está mirando, no hoy: si estoy cargando
  // los vencimientos de octubre estando en septiembre, poner "hoy" obliga a
  // corregir la fecha en cada carga.
  const [dueDate, setDueDate] = useState(month > today ? month : today);
  const [category, setCategory] = useState<ExpenseCategory>("servicios");
  const [allocationId, setAllocationId] = useState<string | null>(null);
  const [isRecurring, setIsRecurring] = useState(false);
  const [notes, setNotes] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();

    const cents = parseMoneyToCents(amount);
    if (cents === null || cents <= 0) {
      toast.error("Poné un monto válido.");
      return;
    }

    setPending(true);
    const { error } = await createClient().from("expenses").insert({
      label: label.trim(),
      amount_cents: cents,
      due_date: dueDate,
      category,
      allocation_id: allocationId,
      is_recurring: isRecurring,
      notes: notes.trim() || null,
    });
    setPending(false);

    if (error) {
      toast.error("No se pudo guardar.");
      return;
    }
    onDone();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <Label htmlFor="expenseLabel">Qué se paga</Label>
        <Input
          id="expenseLabel"
          required
          autoFocus
          maxLength={80}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Alquiler"
        />
      </div>

      <MoneyField id="expenseAmount" label="Monto" value={amount} onChange={setAmount} />

      <div>
        <Label htmlFor="dueDate">Vence el</Label>
        <Input
          id="dueDate"
          type="date"
          required
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
        />
      </div>

      <fieldset>
        <Label>Categoría</Label>
        <div className="flex flex-wrap gap-1.5">
          {EXPENSE_CATEGORIES.map((c) => (
            <Chip
              key={c.value}
              active={category === c.value}
              onClick={() => setCategory(c.value)}
            >
              {c.label}
            </Chip>
          ))}
        </div>
      </fieldset>

      {allocations.length > 0 ? (
        <fieldset>
          <Label>Sale de</Label>
          <div className="flex flex-wrap gap-1.5">
            <Chip active={allocationId === null} onClick={() => setAllocationId(null)}>
              Sin imputar
            </Chip>
            {allocations.map((a) => (
              <Chip
                key={a.id}
                active={allocationId === a.id}
                onClick={() => setAllocationId(a.id)}
              >
                {a.label}
              </Chip>
            ))}
          </div>
        </fieldset>
      ) : null}

      <label className="flex items-center gap-2.5 text-sm text-fg">
        <input
          type="checkbox"
          checked={isRecurring}
          onChange={(e) => setIsRecurring(e.target.checked)}
          className="size-5 accent-[var(--app-primary)]"
        />
        Se repite todos los meses
      </label>

      <div>
        <Label htmlFor="expenseNotes">Notas</Label>
        <Textarea
          id="expenseNotes"
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      <Button type="submit" size="lg" className="w-full" disabled={pending || !label.trim()}>
        {pending ? "Guardando..." : "Guardar gasto"}
      </Button>
    </form>
  );
}

function IncomeForm({
  month,
  today,
  members,
  currentMemberId,
  onDone,
}: {
  month: string;
  today: string;
  members: FamilyMemberRow[];
  currentMemberId: string;
  onDone: () => void;
}) {
  const [label, setLabel] = useState("Sueldo");
  const [amount, setAmount] = useState("");
  const [memberId, setMemberId] = useState<string | null>(currentMemberId);
  const [receivedOn, setReceivedOn] = useState(today);
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();

    const cents = parseMoneyToCents(amount);
    if (cents === null || cents <= 0) {
      toast.error("Poné un monto válido.");
      return;
    }

    setPending(true);
    const { error } = await createClient().from("income_entries").insert({
      label: label.trim(),
      amount_cents: cents,
      // El trigger normaliza al día 1 igual; se manda el mes que se mira.
      period_month: month,
      member_id: memberId,
      received_on: receivedOn || null,
    });
    setPending(false);

    if (error) {
      toast.error("No se pudo guardar.");
      return;
    }
    onDone();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <Label htmlFor="incomeLabel">Qué es</Label>
        <Input
          id="incomeLabel"
          required
          autoFocus
          maxLength={80}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Sueldo, aguinaldo, changa"
        />
      </div>

      <MoneyField id="incomeAmount" label="Monto" value={amount} onChange={setAmount} />

      <fieldset>
        <Label>De quién</Label>
        <div className="flex flex-wrap gap-1.5">
          {members.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setMemberId(m.id === memberId ? null : m.id)}
              aria-pressed={memberId === m.id}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs font-medium",
                memberId === m.id
                  ? "border-primary bg-primary/10 text-fg"
                  : "border-border text-muted",
              )}
            >
              <MemberAvatar member={m} size="sm" />
              {m.display_name}
            </button>
          ))}
        </div>
      </fieldset>

      <div>
        <Label htmlFor="receivedOn">Cobrado el</Label>
        <Input
          id="receivedOn"
          type="date"
          value={receivedOn}
          onChange={(e) => setReceivedOn(e.target.value)}
        />
      </div>

      <Button type="submit" size="lg" className="w-full" disabled={pending || !label.trim()}>
        {pending ? "Guardando..." : "Guardar ingreso"}
      </Button>
    </form>
  );
}

function AllocationForm({
  members,
  onDone,
}: {
  members: FamilyMemberRow[];
  onDone: () => void;
}) {
  const [label, setLabel] = useState("");
  const [percent, setPercent] = useState("10");
  const [memberId, setMemberId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();

    const value = Number(percent.replace(",", "."));
    if (!Number.isFinite(value) || value < 0 || value > 100) {
      toast.error("El porcentaje tiene que estar entre 0 y 100.");
      return;
    }

    setPending(true);
    const { error } = await createClient().from("budget_allocations").insert({
      label: label.trim(),
      percent_bp: Math.round(value * 100),
      member_id: memberId,
    });
    setPending(false);

    if (error) {
      toast.error("No se pudo guardar.");
      return;
    }
    onDone();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <Label htmlFor="allocLabel">Nombre del rubro</Label>
        <Input
          id="allocLabel"
          required
          autoFocus
          maxLength={60}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Vacaciones"
        />
      </div>

      <div>
        <Label htmlFor="allocPercent">Porcentaje del ingreso</Label>
        <Input
          id="allocPercent"
          required
          inputMode="decimal"
          value={percent}
          onChange={(e) => setPercent(e.target.value)}
        />
      </div>

      <fieldset>
        <Label>¿Es una asignación personal?</Label>
        <div className="flex flex-wrap gap-1.5">
          <Chip active={memberId === null} onClick={() => setMemberId(null)}>
            No, es del hogar
          </Chip>
          {members.map((m) => (
            <Chip
              key={m.id}
              active={memberId === m.id}
              onClick={() => setMemberId(m.id)}
            >
              {m.display_name}
            </Chip>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted">
          Una asignación personal es de libre disponibilidad: la app no pide detalle de en qué
          se gastó.
        </p>
      </fieldset>

      <Button type="submit" size="lg" className="w-full" disabled={pending || !label.trim()}>
        {pending ? "Guardando..." : "Crear rubro"}
      </Button>
    </form>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-full border px-3 py-1.5 text-xs font-medium",
        active ? "border-primary bg-primary text-primary-fg" : "border-border text-muted",
      )}
    >
      {children}
    </button>
  );
}
