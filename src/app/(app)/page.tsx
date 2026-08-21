import Link from "next/link";

import { NowStrip } from "@/components/agenda/now-strip";
import { FridgeBoard } from "@/components/board/fridge-board";
import { MyDayCard, type MyStep } from "@/components/panel/my-day-card";
import {
  ExpensesAlert,
  GoalsCard,
  HouseTodayCard,
  MealsCard,
  OverdueAlert,
  ShoppingCard,
} from "@/components/panel/summary-cards";
import { SectionHeading } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { minutesNowAr } from "@/lib/agenda/blocks";
import { fetchTimeBlocks } from "@/lib/agenda/queries";
import { requireFamily } from "@/lib/auth/context";
import { expenseStatus } from "@/lib/budget/allocate";
import { addDaysIso, formatLongDate, todayInAr } from "@/lib/dates";
import { fetchGoals } from "@/lib/goals/queries";
import { openStepsFor } from "@/lib/goals/progress";
import { fetchNotes } from "@/lib/notes/queries";
import {
  ensureInstances,
  fetchEventsBetween,
  fetchOverdueTasks,
  fetchTasksBetween,
} from "@/lib/planner/queries";
import { fetchItems, fetchLists } from "@/lib/shopping/queries";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Panel" };

/**
 * El panel.
 *
 * La versión anterior era una lista larga: saludo, un párrafo con las tareas
 * propias, dos avisos y el tablero de notas. Se leía de arriba abajo y no
 * contestaba nada rápido.
 *
 * Este está ordenado por la pregunta que responde cada franja:
 *
 *   1. ¿Qué está pasando ahora y qué sigue?   -> NowStrip
 *   2. ¿Hay algo que se está prendiendo fuego? -> alertas (se esconden solas)
 *   3. ¿Qué me toca a mí?                      -> MyDayCard, y se tilda ahí
 *   4. ¿Cómo viene la casa?                    -> el resto, en tarjetas
 *
 * En escritorio son dos columnas: lo que se hace a la izquierda, lo que se
 * consulta a la derecha. En el teléfono la misma información en una columna,
 * en ese orden.
 */
export default async function PanelPage() {
  const { family, members, member, role } = await requireFamily();
  const supabase = await createClient();
  const today = todayInAr();

  // Antes de leer: si nadie abrió el planner en un mes, las ocurrencias de esta
  // semana todavía no existen y el resumen del día saldría vacío.
  await ensureInstances(supabase, today);

  const [notes, todayTasks, todayEvents, overdue, dueSoon, blocks, goals, meals, lists, items] =
    await Promise.all([
      fetchNotes(supabase),
      fetchTasksBetween(supabase, today, today),
      fetchEventsBetween(supabase, today, today),
      fetchOverdueTasks(supabase, today),
      // Vencimientos impagos que ya vencieron o vencen pronto. RLS devuelve
      // cero filas si quien mira no es adulto, así que no hace falta chequear
      // el rol: la tarjeta simplemente no aparece.
      supabase
        .from("expenses")
        .select("*")
        .is("paid_on", null)
        .lte("due_date", addDaysIso(today, 5))
        .order("due_date", { ascending: true }),
      fetchTimeBlocks(supabase, today, today),
      fetchGoals(supabase),
      supabase.from("meal_plan").select("*, recipe:recipes(title, minutes)").eq("meal_date", today),
      fetchLists(supabase),
      fetchItems(supabase),
    ]);

  const urgentExpenses = (dueSoon.data ?? []).filter(
    (expense) => expenseStatus(expense, today) !== "pendiente",
  );
  const urgentCents = urgentExpenses.reduce((sum, e) => sum + e.amount_cents, 0);

  const myTasks = todayTasks.filter((t) => t.assigned_member_id === member.id);
  const goalTitles = new Map(goals.map((goal) => [goal.id, goal.title]));
  const mySteps: MyStep[] = openStepsFor(goals, member.id)
    .slice(0, 5)
    .map((step) => ({ step, goalTitle: goalTitles.get(step.goal_id) ?? "Objetivo" }));

  const firstName = member.display_name.split(" ")[0];

  return (
    <>
      <PageHeader
        title={`${greeting(minutesNowAr())}, ${firstName}`}
        subtitle={capitalize(formatLongDate(today))}
        actions={
          <Link href="/dia" className="font-display text-sm font-bold text-primary">
            Ver el día
          </Link>
        }
      />

      <div className="space-y-5">
        <NowStrip
          blocks={blocks}
          events={todayEvents}
          date={today}
          members={members}
          serverNowMinutes={minutesNowAr()}
        />

        {overdue.length > 0 || urgentExpenses.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <OverdueAlert count={overdue.length} />
            <ExpensesAlert count={urgentExpenses.length} cents={urgentCents} />
          </div>
        ) : null}

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:items-start">
          <div className="space-y-5">
            <MyDayCard
              tasks={myTasks}
              steps={mySteps}
              members={members}
              today={today}
              firstName={firstName}
            />

            <section>
              <SectionHeading
                title="La heladera"
                action={
                  <span className="font-display text-xs font-bold text-muted">
                    {family.name}
                  </span>
                }
              />
              <FridgeBoard
                initialNotes={notes}
                members={members}
                currentMemberId={member.id}
                isParent={role === "parent"}
              />
            </section>
          </div>

          <div className="space-y-4">
            <HouseTodayCard tasks={todayTasks} members={members} />
            <GoalsCard goals={goals} />
            <MealsCard meals={meals.data ?? []} />
            <ShoppingCard lists={lists} items={items} />
          </div>
        </div>
      </div>
    </>
  );
}

/**
 * "Buen día" hasta las 12, "buenas tardes" hasta las 20, "buenas noches"
 * después. Es cómo se saluda acá, y es la diferencia entre una app que parece
 * escrita para esta casa y una traducida.
 */
function greeting(minutes: number): string {
  if (minutes < 12 * 60) return "Buen día";
  if (minutes < 20 * 60) return "Buenas tardes";
  return "Buenas noches";
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
