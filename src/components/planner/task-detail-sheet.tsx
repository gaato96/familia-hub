"use client";

import { Ban, Check, CircleCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { MemberChip, UnassignedChip } from "@/components/app/member-chip";
import { Button } from "@/components/ui/button";
import { formatLongDate } from "@/lib/dates";
import type { PlannerTask } from "@/lib/planner/queries";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { FamilyMemberRow, TaskStepRow } from "@/types/database";

/**
 * El detalle de una ocurrencia: la guía de "qué hacer / qué NO hacer" y el
 * tildado paso por paso.
 *
 * Los pasos tildados se guardan en `task_instances.done_step_ids`, o sea por
 * ocurrencia y no por tarea: la próxima vez que toque limpiar el baño, la
 * checklist arranca limpia otra vez.
 */
export function TaskDetailSheet({
  task,
  assignee,
  done,
  onToggle,
  onChanged,
}: {
  task: PlannerTask;
  assignee: FamilyMemberRow | undefined;
  done: boolean;
  onToggle: () => void;
  onChanged: () => void;
}) {
  const [steps, setSteps] = useState<TaskStepRow[] | null>(null);
  const [checked, setChecked] = useState<string[]>(task.done_step_ids);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const { data } = await createClient()
        .from("task_steps")
        .select("*")
        .eq("task_id", task.task_id)
        .order("position", { ascending: true });

      if (!cancelled) setSteps(data ?? []);
    })();

    return () => {
      cancelled = true;
    };
  }, [task.task_id]);

  async function toggleStep(stepId: string) {
    const next = checked.includes(stepId)
      ? checked.filter((id) => id !== stepId)
      : [...checked, stepId];

    setChecked(next);

    const { error } = await createClient()
      .from("task_instances")
      .update({ done_step_ids: next })
      .eq("id", task.id);

    if (error) {
      setChecked(checked);
      toast.error("No se pudo guardar el paso.");
    }
  }

  const todo = (steps ?? []).filter((s) => s.kind === "do");
  const avoid = (steps ?? []).filter((s) => s.kind === "dont");

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 text-sm">
        {assignee ? <MemberChip member={assignee} /> : <UnassignedChip />}
        <span className="text-muted">{formatLongDate(task.due_date)}</span>
      </div>

      {task.task?.notes ? (
        <p className="whitespace-pre-wrap rounded-app bg-surface-2 p-3 text-sm text-fg">
          {task.task.notes}
        </p>
      ) : null}

      {todo.length > 0 ? (
        <section>
          <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-fg">
            <CircleCheck className="size-4 text-success" />
            Qué hacer
          </h3>
          <ul className="space-y-1">
            {todo.map((step) => {
              const isChecked = checked.includes(step.id);
              return (
                <li key={step.id}>
                  <button
                    type="button"
                    onClick={() => toggleStep(step.id)}
                    role="checkbox"
                    aria-checked={isChecked}
                    className="flex w-full items-start gap-2.5 rounded-lg py-2 text-left"
                  >
                    <span
                      className={cn(
                        "mt-0.5 grid size-5 shrink-0 place-items-center rounded border-2",
                        isChecked ? "border-success bg-success text-white" : "border-border",
                      )}
                    >
                      {isChecked ? <Check className="size-3 stroke-[3]" /> : null}
                    </span>
                    <span
                      className={cn(
                        "text-sm",
                        isChecked ? "text-muted line-through" : "text-fg",
                      )}
                    >
                      {step.label}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {avoid.length > 0 ? (
        <section>
          <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-fg">
            <Ban className="size-4 text-danger" />
            Qué no hacer
          </h3>
          {/* Sin checkbox a propósito: no son pasos que se completan, son
              advertencias. Un tilde al lado invitaría a tildarlas igual. */}
          <ul className="space-y-1.5 rounded-app bg-danger/5 p-3">
            {avoid.map((step) => (
              <li key={step.id} className="flex gap-2 text-sm text-fg">
                <span aria-hidden className="text-danger">
                  ·
                </span>
                {step.label}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <Button
        onClick={() => {
          onToggle();
          onChanged();
        }}
        size="lg"
        variant={done ? "outline" : "primary"}
        className="w-full"
      >
        {done ? "Marcar como pendiente" : "Marcar como hecha"}
      </Button>
    </div>
  );
}
