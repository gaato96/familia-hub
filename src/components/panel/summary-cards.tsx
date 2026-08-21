import {
  ArrowRight,
  ShoppingCart,
  Target,
  TriangleAlert,
  UtensilsCrossed,
  Wallet,
} from "lucide-react";
import Link from "next/link";

import { MemberAvatar } from "@/components/app/member-chip";
import { Card } from "@/components/ui/card";
import { ProgressBar, ProgressRing } from "@/components/ui/progress";
import { formatMoney } from "@/lib/money";
import { mealLabel, type PlannedMeal } from "@/lib/meals/queries";
import { goalProgress, summarizeGoals, type GoalWithSteps } from "@/lib/goals/progress";
import type { PlannerTask } from "@/lib/planner/queries";
import type { ShoppingItem, ShoppingList } from "@/lib/shopping/queries";
import { cn } from "@/lib/utils";
import type { FamilyMemberRow } from "@/types/database";

/**
 * Las tarjetas chicas del panel.
 *
 * Todas son componentes de servidor y todas terminan en un link: el panel no
 * es un lugar donde se trabaja, es el lugar desde donde se decide adónde ir. La
 * única excepción es tildar lo propio, que está en `MyDayCard` justamente
 * porque es la acción que no vale la pena postergar un toque más.
 *
 * Cada una se esconde sola cuando no tiene nada que decir. Un panel con seis
 * tarjetas vacías que dicen "no hay nada" es peor que un panel corto.
 */

function CardLink({
  href,
  title,
  icon,
  children,
  className,
}: {
  href: string;
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link href={href} className={cn("block", className)}>
      <Card className="h-full transition-shadow hover:shadow-float">
        <div className="mb-2 flex items-center gap-2">
          <span className="text-secondary [&_svg]:size-4">{icon}</span>
          <h3 className="font-display text-sm font-bold text-fg">{title}</h3>
          <ArrowRight className="ml-auto size-4 text-muted" />
        </div>
        {children}
      </Card>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Alertas
// ---------------------------------------------------------------------------

/** Tareas atrasadas de toda la casa. */
export function OverdueAlert({ count }: { count: number }) {
  if (count === 0) return null;

  return (
    <Link href="/planner">
      <Card tone="warning" className="flex items-center gap-3 py-3">
        <TriangleAlert className="size-5 shrink-0" />
        <span className="text-sm">
          <span className="font-bold">
            {count} {count === 1 ? "tarea atrasada" : "tareas atrasadas"}
          </span>{" "}
          en la casa.
        </span>
        <ArrowRight className="ml-auto size-4 shrink-0" />
      </Card>
    </Link>
  );
}

/**
 * Vencimientos impagos.
 *
 * RLS ya devuelve cero filas si quien mira no es adulto, así que no hace falta
 * chequear el rol: la tarjeta simplemente no aparece.
 */
export function ExpensesAlert({ count, cents }: { count: number; cents: number }) {
  if (count === 0) return null;

  return (
    <Link href="/finanzas">
      <Card tone="danger" className="flex items-center gap-3 py-3">
        <Wallet className="size-5 shrink-0" />
        <span className="text-sm">
          <span className="font-bold">
            {count} {count === 1 ? "vencimiento" : "vencimientos"}
          </span>{" "}
          por {formatMoney(cents)}.
        </span>
        <ArrowRight className="ml-auto size-4 shrink-0" />
      </Card>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// La casa hoy
// ---------------------------------------------------------------------------

/**
 * Cómo viene el día para toda la casa.
 *
 * Muestra el avance por persona y no un número solo. El total esconde
 * justamente lo que se quiere ver: si el 70% de la casa lo está haciendo una
 * sola persona, el 70% es una mala noticia disfrazada de buena.
 */
export function HouseTodayCard({
  tasks,
  members,
}: {
  tasks: PlannerTask[];
  members: FamilyMemberRow[];
}) {
  const done = tasks.filter((t) => t.status === "done").length;
  const ratio = tasks.length === 0 ? 0 : done / tasks.length;

  const perMember = members
    .map((member) => {
      const mine = tasks.filter((t) => t.assigned_member_id === member.id);
      return {
        member,
        total: mine.length,
        done: mine.filter((t) => t.status === "done").length,
      };
    })
    .filter((row) => row.total > 0);

  return (
    <Card>
      <div className="mb-3 flex items-center gap-3">
        <ProgressRing value={ratio} size={56} label="Tareas de la casa hechas hoy" />
        <div className="min-w-0">
          <h3 className="font-display text-base font-bold text-fg">La casa hoy</h3>
          <p className="text-sm text-muted">
            {tasks.length === 0
              ? "Sin tareas para hoy."
              : `${done} de ${tasks.length} ${tasks.length === 1 ? "tarea hecha" : "tareas hechas"}`}
          </p>
        </div>
      </div>

      {perMember.length > 0 ? (
        <ul className="space-y-2">
          {perMember.map(({ member, total, done: memberDone }) => (
            <li key={member.id} className="flex items-center gap-2.5">
              <MemberAvatar member={member} size="sm" />
              <span className="w-16 shrink-0 truncate text-xs font-semibold text-muted">
                {member.display_name.split(" ")[0]}
              </span>
              <ProgressBar
                value={memberDone / total}
                tone={memberDone === total ? "success" : "info"}
                className="h-1.5"
              />
              <span className="w-9 shrink-0 text-right text-[11px] font-bold tabular-nums text-muted">
                {memberDone}/{total}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Objetivos
// ---------------------------------------------------------------------------

export function GoalsCard({ goals }: { goals: GoalWithSteps[] }) {
  const summary = summarizeGoals(goals);
  const active = goals.filter((g) => g.status === "activo").slice(0, 3);

  if (goals.length === 0) {
    return (
      <CardLink href="/objetivos" title="Objetivos" icon={<Target />}>
        <p className="text-sm text-muted">
          Todavía no hay ninguno. Sirven para lo que no entra en una tarea suelta.
        </p>
      </CardLink>
    );
  }

  return (
    <CardLink href="/objetivos" title="Objetivos" icon={<Target />}>
      <p className="mb-2.5 text-sm text-muted">
        {summary.doneSteps} de {summary.steps} pasos ·{" "}
        {Math.round(summary.ratio * 100)}%
      </p>
      <ul className="space-y-2">
        {active.map((goal) => {
          const progress = goalProgress(goal);
          return (
            <li key={goal.id}>
              <p className="mb-1 truncate text-xs font-semibold text-fg">{goal.title}</p>
              <ProgressBar value={progress.ratio} className="h-1.5" />
            </li>
          );
        })}
      </ul>
    </CardLink>
  );
}

// ---------------------------------------------------------------------------
// Comidas
// ---------------------------------------------------------------------------

export function MealsCard({ meals }: { meals: PlannedMeal[] }) {
  const almuerzo = meals.find((m) => m.slot === "almuerzo");
  const cena = meals.find((m) => m.slot === "cena");

  return (
    <CardLink href="/comidas" title="Qué se come hoy" icon={<UtensilsCrossed />}>
      <dl className="space-y-1.5 text-sm">
        <div className="flex gap-2">
          <dt className="w-20 shrink-0 text-muted">Almuerzo</dt>
          <dd className={cn("min-w-0 truncate", almuerzo ? "font-semibold text-fg" : "text-muted")}>
            {almuerzo ? mealLabel(almuerzo) : "sin definir"}
          </dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-20 shrink-0 text-muted">Cena</dt>
          <dd className={cn("min-w-0 truncate", cena ? "font-semibold text-fg" : "text-muted")}>
            {cena ? mealLabel(cena) : "sin definir"}
          </dd>
        </div>
      </dl>
    </CardLink>
  );
}

// ---------------------------------------------------------------------------
// Compras
// ---------------------------------------------------------------------------

export function ShoppingCard({
  lists,
  items,
}: {
  lists: ShoppingList[];
  items: ShoppingItem[];
}) {
  const pending = items.filter((item) => !item.is_checked);

  const byList = lists
    .map((list) => ({
      list,
      count: pending.filter((item) => item.list_id === list.id).length,
    }))
    .filter((row) => row.count > 0)
    .slice(0, 4);

  return (
    <CardLink href="/compras" title="Falta comprar" icon={<ShoppingCart />}>
      {pending.length === 0 ? (
        <p className="text-sm text-muted">Las listas están al día.</p>
      ) : (
        <ul className="space-y-1.5 text-sm">
          {byList.map(({ list, count }) => (
            <li key={list.id} className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate text-fg">{list.name}</span>
              <span className="shrink-0 rounded-full bg-surface-2 px-2 py-0.5 text-xs font-bold text-muted">
                {count}
              </span>
            </li>
          ))}
        </ul>
      )}
    </CardLink>
  );
}
