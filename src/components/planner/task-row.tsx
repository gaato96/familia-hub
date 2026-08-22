"use client";

import { ChevronRight } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { MemberAvatar } from "@/components/app/member-chip";
import { TaskDetailSheet } from "@/components/planner/task-detail-sheet";
import { CircleCheckbox } from "@/components/ui/checkbox";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import type { PlannerTask } from "@/lib/planner/queries";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { FamilyMemberRow } from "@/types/database";

const PRIORITY_DOT = {
  alta: "bg-danger",
  normal: "bg-transparent",
  baja: "bg-transparent",
} as const;

export function TaskRow({
  task,
  assignee,
  onChanged,
}: {
  task: PlannerTask;
  assignee: FamilyMemberRow | undefined;
  onChanged: () => void;
}) {
  const [done, setDone] = useState(task.status === "done");
  const [detailOpen, setDetailOpen] = useState(false);

  async function toggle() {
    const next = !done;
    // Optimista: en la práctica se tildan cinco tareas seguidas y esperar el
    // round trip de cada una hace que la lista se sienta trabada.
    setDone(next);

    const { error } = await createClient()
      .from("task_instances")
      // completed_at y completed_by los sella el trigger del servidor: el reloj
      // del teléfono no es fuente de verdad para "cuándo se hizo".
      .update({ status: next ? "done" : "pending" })
      .eq("id", task.id);

    if (error) {
      setDone(!next);
      toast.error("No se pudo actualizar la tarea.");
      return;
    }
    onChanged();
  }

  return (
    <>
      <li className="flex items-center gap-2">
        <CircleCheckbox
          checked={done}
          label={`Marcar "${task.task?.title ?? "tarea"}" como ${done ? "pendiente" : "hecha"}`}
          onClick={toggle}
        />

        <button
          type="button"
          onClick={() => setDetailOpen(true)}
          className="flex min-w-0 flex-1 items-center gap-2 py-2 text-left"
        >
          <span
            aria-hidden
            className={cn("size-1.5 shrink-0 rounded-full", PRIORITY_DOT[task.task?.priority ?? "normal"])}
          />
          <span
            className={cn(
              "min-w-0 flex-1 truncate text-sm",
              done ? "text-muted line-through" : "text-fg",
            )}
          >
            {task.task?.title ?? "Tarea"}
          </span>
          {assignee ? <MemberAvatar member={assignee} size="sm" /> : null}
          <ChevronRight className="size-4 shrink-0 text-muted" />
        </button>
      </li>

      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent title={task.task?.title ?? "Tarea"}>
          <TaskDetailSheet
            task={task}
            assignee={assignee}
            done={done}
            onToggle={toggle}
            onChanged={onChanged}
            onDeleted={() => {
              setDetailOpen(false);
              onChanged();
            }}
          />
        </SheetContent>
      </Sheet>
    </>
  );
}
