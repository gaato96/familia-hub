import { AlertTriangle, CalendarDays, CircleCheck, Wallet } from "lucide-react";
import Link from "next/link";

import { DaySummary } from "@/components/app/day-summary";
import { FridgeBoard } from "@/components/board/fridge-board";
import { requireFamily } from "@/lib/auth/context";
import { expenseStatus } from "@/lib/budget/allocate";
import { addDaysIso, todayInAr } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { fetchNotes } from "@/lib/notes/queries";
import {
  ensureInstances,
  fetchEventsBetween,
  fetchOverdueTasks,
  fetchTasksBetween,
} from "@/lib/planner/queries";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "La heladera" };

/**
 * Inicio. Dos cosas y nada más: qué pasa hoy, y qué dejaron pegado los demás.
 *
 * El resumen va ARRIBA del tablero aunque el tablero sea lo divertido: lo que
 * hace que alguien abra la app a las 8 de la mañana es saber qué le toca hoy.
 */
export default async function InicioPage() {
  const { family, members, member, role } = await requireFamily();
  const supabase = await createClient();
  const today = todayInAr();

  // Antes de leer: si nadie abrió el planner en un mes, las ocurrencias de esta
  // semana todavía no existen y el resumen del día saldría vacío.
  await ensureInstances(supabase, today);

  const [notes, todayTasks, todayEvents, overdue, dueSoon] = await Promise.all([
    fetchNotes(supabase),
    fetchTasksBetween(supabase, today, today),
    fetchEventsBetween(supabase, today, today),
    fetchOverdueTasks(supabase, today),
    // Vencimientos impagos que ya vencieron o vencen pronto. RLS devuelve cero
    // filas si quien mira no es adulto, así que no hace falta chequear el rol:
    // la tarjeta simplemente no aparece.
    supabase
      .from("expenses")
      .select("*")
      .is("paid_on", null)
      .lte("due_date", addDaysIso(today, 5))
      .order("due_date", { ascending: true }),
  ]);

  const urgentExpenses = (dueSoon.data ?? []).filter(
    (expense) => expenseStatus(expense, today) !== "pendiente",
  );
  const urgentCents = urgentExpenses.reduce((sum, e) => sum + e.amount_cents, 0);

  const mine = todayTasks.filter((t) => t.assigned_member_id === member.id);
  const pendingMine = mine.filter((t) => t.status === "pending");

  return (
    <div className="space-y-5">
      <header className="flex items-baseline justify-between gap-3">
        <div>
          <p className="text-sm text-muted">{family.name}</p>
          <h1 className="text-2xl font-bold tracking-tight text-fg">
            Hola, {member.display_name.split(" ")[0]}
          </h1>
        </div>
        <Link href="/planner" className="text-sm font-semibold text-primary">
          Ver la semana
        </Link>
      </header>

      {/* Lo primero que se lee: qué le toca a esta persona, hoy. */}
      <section className="rounded-app border border-border bg-surface p-4">
        <p className="flex items-center gap-2 text-sm font-semibold text-muted">
          {pendingMine.length === 0 ? (
            <CircleCheck className="size-4 text-success" />
          ) : (
            <CalendarDays className="size-4" />
          )}
          Tu día
        </p>
        <p className="mt-1 text-fg">
          {pendingMine.length === 0
            ? mine.length === 0
              ? "No tenés nada asignado para hoy."
              : "Ya hiciste todo lo tuyo de hoy."
            : `Te quedan ${pendingMine.length} ${
                pendingMine.length === 1 ? "tarea" : "tareas"
              }.`}
        </p>
      </section>

      {overdue.length > 0 ? (
        <Link
          href="/planner?filtro=atrasadas"
          className="flex items-center gap-3 rounded-app border border-warning/40 bg-warning/10 p-3 text-sm"
        >
          <AlertTriangle className="size-5 shrink-0 text-warning" />
          <span className="text-fg">
            <span className="font-semibold">
              {overdue.length} {overdue.length === 1 ? "tarea atrasada" : "tareas atrasadas"}
            </span>{" "}
            en la casa.
          </span>
        </Link>
      ) : null}

      {urgentExpenses.length > 0 ? (
        <Link
          href="/finanzas"
          className="flex items-center gap-3 rounded-app border border-danger/40 bg-danger/5 p-3 text-sm"
        >
          <Wallet className="size-5 shrink-0 text-danger" />
          <span className="text-fg">
            <span className="font-semibold">
              {urgentExpenses.length}{" "}
              {urgentExpenses.length === 1 ? "vencimiento" : "vencimientos"}
            </span>{" "}
            por {formatMoney(urgentCents)}.
          </span>
        </Link>
      ) : null}

      <DaySummary tasks={todayTasks} events={todayEvents} members={members} />

      <section>
        <h2 className="mb-2 text-sm font-semibold text-muted">La heladera</h2>
        <FridgeBoard
          initialNotes={notes}
          members={members}
          currentMemberId={member.id}
          isParent={role === "parent"}
        />
      </section>
    </div>
  );
}
