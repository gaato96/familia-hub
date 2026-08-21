"use client";

import { CircleCheck, Target } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { TaskRow } from "@/components/planner/task-row";
import { Card } from "@/components/ui/card";
import { CircleCheckbox } from "@/components/ui/checkbox";
import { relativeDayLabel, type IsoDate } from "@/lib/dates";
import type { PlannerTask } from "@/lib/planner/queries";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { FamilyMemberRow, GoalStepRow } from "@/types/database";

export type MyStep = { step: GoalStepRow; goalTitle: string };

/**
 * "Lo tuyo, hoy."
 *
 * Junta dos cosas que la base guarda separadas —las tareas de la casa y los
 * pasos de los objetivos— porque para la persona que abre la app son la misma
 * cosa: lo que le toca hacer. Tenerlas en dos pantallas distintas es cómo se
 * consigue que una de las dos no la mire nadie.
 *
 * Se tilda acá mismo. Mandar a otra pantalla para tildar es lo que hace que la
 * gente tilde tres días después, todo junto y de memoria.
 */
export function MyDayCard({
  tasks,
  steps,
  members,
  today,
  firstName,
}: {
  tasks: PlannerTask[];
  steps: MyStep[];
  members: FamilyMemberRow[];
  today: IsoDate;
  firstName: string;
}) {
  const router = useRouter();
  const byId = new Map(members.map((m) => [m.id, m]));
  const pending = tasks.filter((t) => t.status === "pending").length;

  if (tasks.length === 0 && steps.length === 0) {
    return (
      <Card tone="success" className="flex items-center gap-3">
        <CircleCheck className="size-8 shrink-0" />
        <div>
          <p className="font-display text-base font-bold">Tenés el día libre, {firstName}.</p>
          <p className="text-sm opacity-80">No hay nada asignado a tu nombre para hoy.</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="space-y-1">
      <p className="px-2 pb-1 font-display text-base font-bold text-fg">
        Lo tuyo, hoy
        {pending > 0 ? (
          <span className="ml-2 rounded-full bg-primary-soft px-2 py-0.5 text-xs text-primary-soft-fg">
            {pending} sin hacer
          </span>
        ) : (
          <span className="ml-2 text-sm font-semibold text-success">todo listo</span>
        )}
      </p>

      <ul className="divide-y divide-border px-1">
        {tasks.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            assignee={task.assigned_member_id ? byId.get(task.assigned_member_id) : undefined}
            onChanged={() => router.refresh()}
          />
        ))}
        {steps.map(({ step, goalTitle }) => (
          <GoalStepRowCompact
            key={step.id}
            step={step}
            goalTitle={goalTitle}
            today={today}
            onChanged={() => router.refresh()}
          />
        ))}
      </ul>
    </Card>
  );
}

function GoalStepRowCompact({
  step,
  goalTitle,
  today,
  onChanged,
}: {
  step: GoalStepRow;
  goalTitle: string;
  today: IsoDate;
  onChanged: () => void;
}) {
  const [done, setDone] = useState(step.done_at !== null);
  const overdue = !done && step.due_date !== null && step.due_date < today;

  async function toggle() {
    const next = !done;
    setDone(next);

    const { error } = await createClient()
      .from("goal_steps")
      .update({ done_at: next ? new Date().toISOString() : null })
      .eq("id", step.id);

    if (error) {
      setDone(!next);
      toast.error("No se pudo actualizar el paso.");
      return;
    }
    onChanged();
  }

  return (
    <li className="flex items-center gap-1">
      <CircleCheckbox
        checked={done}
        label={`Marcar "${step.title}" como ${done ? "pendiente" : "hecho"}`}
        onClick={toggle}
      />
      <Link href="/objetivos" className="min-w-0 flex-1 py-2">
        <span
          className={cn("block truncate text-sm", done ? "text-muted line-through" : "text-fg")}
        >
          {step.title}
        </span>
        <span className="flex items-center gap-1 text-[11px] text-muted">
          <Target className="size-3 shrink-0" />
          <span className="truncate">{goalTitle}</span>
          {step.due_date ? (
            <span className={cn("shrink-0", overdue && "font-bold text-danger")}>
              · {relativeDayLabel(step.due_date, today)}
            </span>
          ) : null}
        </span>
      </Link>
    </li>
  );
}
