"use client";

import { CalendarDays, Pause, Pencil, Play, Plus, Target, Trash2, Trophy } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { GoalForm } from "@/components/objetivos/goal-form";
import { MemberAvatar } from "@/components/app/member-chip";
import { Badge } from "@/components/ui/badge";
import { Button, Fab } from "@/components/ui/button";
import { Card, EmptyState } from "@/components/ui/card";
import { CircleCheckbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { ProgressBar, ProgressRing } from "@/components/ui/progress";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { relativeDayLabel, type IsoDate } from "@/lib/dates";
import {
  goalCategoryLabel,
  goalProgress,
  goalUrgency,
  summarizeGoals,
  type GoalWithSteps,
} from "@/lib/goals/progress";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { FamilyMemberRow, GoalRow, GoalStatus, GoalStepRow } from "@/types/database";

export function GoalsView({
  goals,
  members,
  today,
}: {
  goals: GoalWithSteps[];
  members: FamilyMemberRow[];
  today: IsoDate;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<GoalRow | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const summary = summarizeGoals(goals);
  const refresh = () => router.refresh();

  function openNew() {
    setEditing(null);
    setFormOpen(true);
  }

  return (
    <div className="space-y-5">
      {goals.length > 0 ? (
        <Card className="flex items-center gap-4">
          <ProgressRing value={summary.ratio} size={64} label="Avance de la casa" />
          <div className="min-w-0">
            <p className="font-display text-base font-bold text-fg">
              {summary.active === 0
                ? "Sin objetivos activos"
                : `${summary.active} ${summary.active === 1 ? "objetivo" : "objetivos"} en marcha`}
            </p>
            <p className="text-sm text-muted">
              {summary.doneSteps} de {summary.steps}{" "}
              {summary.steps === 1 ? "paso hecho" : "pasos hechos"}
              {summary.achieved > 0
                ? ` · ${summary.achieved} ${summary.achieved === 1 ? "logrado" : "logrados"}`
                : ""}
            </p>
          </div>
        </Card>
      ) : null}

      {goals.length === 0 ? (
        <EmptyState
          icon={<Target />}
          title="Todavía no hay objetivos"
          hint="Sirven para lo que no entra en una tarea suelta: ordenar el garage, juntar para las vacaciones, que Julián duerma en su cuarto."
          action={
            <Button onClick={openNew}>
              <Plus /> Crear el primero
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {goals.map((goal) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              members={members}
              today={today}
              onChanged={refresh}
              onEdit={() => {
                setEditing(goal);
                setFormOpen(true);
              }}
            />
          ))}
        </div>
      )}

      <Fab onClick={openNew} aria-label="Nuevo objetivo">
        <Plus />
      </Fab>

      <Sheet
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditing(null);
        }}
      >
        <SheetContent title={editing ? "Editar objetivo" : "Nuevo objetivo"}>
          <GoalForm
            key={editing?.id ?? "nuevo"}
            members={members}
            goal={editing ?? undefined}
            onDone={() => {
              setFormOpen(false);
              setEditing(null);
              refresh();
            }}
          />
        </SheetContent>
      </Sheet>
    </div>
  );
}

const URGENCY_LABEL = {
  vencido: "Se pasó la fecha",
  hoy: "Es hoy",
  "esta-semana": "Esta semana",
} as const;

function GoalCard({
  goal,
  members,
  today,
  onChanged,
  onEdit,
}: {
  goal: GoalWithSteps;
  members: FamilyMemberRow[];
  today: IsoDate;
  onChanged: () => void;
  onEdit: () => void;
}) {
  const [adding, setAdding] = useState("");
  const byId = new Map(members.map((m) => [m.id, m]));

  const progress = goalProgress(goal);
  const urgency = goalUrgency(goal, today);
  const owner = goal.owner_member_id ? byId.get(goal.owner_member_id) : undefined;
  const achieved = goal.status === "logrado";

  async function setStatus(status: GoalStatus) {
    // achieved_on lo sella el trigger: la fecha de cuándo se logró algo no sale
    // del reloj del teléfono.
    const { error } = await createClient().from("goals").update({ status }).eq("id", goal.id);
    if (error) {
      toast.error("No se pudo cambiar el estado.");
      return;
    }
    if (status === "logrado") toast.success("¡Objetivo logrado!");
    onChanged();
  }

  async function remove() {
    const { error } = await createClient().from("goals").delete().eq("id", goal.id);
    if (error) {
      toast.error("No se pudo borrar. Puede que lo haya creado otra persona.");
      return;
    }
    onChanged();
  }

  async function addStep(event: React.FormEvent) {
    event.preventDefault();
    const title = adding.trim();
    if (!title) return;

    setAdding("");
    const { error } = await createClient().from("goal_steps").insert({
      goal_id: goal.id,
      title,
      position: goal.steps.length,
    });

    if (error) {
      toast.error("No se pudo agregar el paso.");
      return;
    }
    onChanged();
  }

  return (
    <Card className={cn("flex flex-col gap-3", achieved && "opacity-75")}>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-1.5">
            <Badge tone={achieved ? "success" : "info"}>
              {achieved ? <Trophy /> : null}
              {achieved ? "Logrado" : goalCategoryLabel(goal.category)}
            </Badge>
            {goal.status === "pausado" ? <Badge tone="neutral">En pausa</Badge> : null}
            {urgency ? (
              <Badge tone={urgency === "vencido" ? "danger" : "warning"}>
                <CalendarDays />
                {URGENCY_LABEL[urgency]}
              </Badge>
            ) : null}
          </div>

          <h3
            className={cn(
              "font-display text-lg font-bold leading-tight text-fg",
              achieved && "line-through",
            )}
          >
            {goal.title}
          </h3>

          {goal.detail ? (
            <p className="mt-1 text-sm text-muted">{goal.detail}</p>
          ) : null}

          <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
            {owner ? (
              <span className="flex items-center gap-1.5">
                <MemberAvatar member={owner} size="sm" />
                {owner.display_name.split(" ")[0]}
              </span>
            ) : (
              <span>De toda la casa</span>
            )}
            {goal.target_date && !achieved ? (
              <span>· para {relativeDayLabel(goal.target_date, today)}</span>
            ) : null}
            {achieved && goal.achieved_on ? (
              <span>· logrado {relativeDayLabel(goal.achieved_on, today)}</span>
            ) : null}
          </p>
        </div>

        <Menu>
          <MenuTrigger />
          <MenuContent>
            {achieved ? (
              <MenuItem onSelect={() => setStatus("activo")}>
                <Play /> Reabrir
              </MenuItem>
            ) : (
              <MenuItem onSelect={() => setStatus("logrado")}>
                <Trophy /> Marcar como logrado
              </MenuItem>
            )}
            {goal.status === "pausado" ? (
              <MenuItem onSelect={() => setStatus("activo")}>
                <Play /> Retomar
              </MenuItem>
            ) : goal.status === "activo" ? (
              <MenuItem onSelect={() => setStatus("pausado")}>
                <Pause /> Poner en pausa
              </MenuItem>
            ) : null}
            <MenuItem onSelect={onEdit}>
              <Pencil /> Editar
            </MenuItem>
            <MenuSeparator />
            <MenuItem danger onSelect={remove}>
              <Trash2 /> Borrar
            </MenuItem>
          </MenuContent>
        </Menu>
      </div>

      {progress.total > 0 ? (
        <div>
          <div className="mb-1.5 flex items-baseline justify-between text-xs font-bold text-muted">
            <span>
              {progress.done} de {progress.total}
            </span>
            <span>{Math.round(progress.ratio * 100)}%</span>
          </div>
          <ProgressBar value={progress.ratio} tone={achieved ? "success" : "primary"} />
        </div>
      ) : null}

      <ul className="divide-y divide-border">
        {goal.steps.map((step) => (
          <StepRow
            key={step.id}
            step={step}
            members={members}
            today={today}
            onChanged={onChanged}
          />
        ))}
      </ul>

      {!achieved ? (
        <form onSubmit={addStep} className="flex gap-1.5">
          <Input
            value={adding}
            onChange={(e) => setAdding(e.target.value)}
            placeholder="Agregar un paso"
            aria-label={`Agregar un paso a ${goal.title}`}
            className="h-10 flex-1 text-sm"
          />
          <Button
            type="submit"
            variant="soft"
            size="icon-sm"
            disabled={!adding.trim()}
            aria-label="Agregar paso"
          >
            <Plus />
          </Button>
        </form>
      ) : null}
    </Card>
  );
}

/**
 * Un paso.
 *
 * El responsable se elige con un `<select>` nativo y no con un menú propio: en
 * el teléfono abre la rueda del sistema, que es más rápida y más accesible que
 * cualquier cosa que se pueda dibujar acá.
 */
function StepRow({
  step,
  members,
  today,
  onChanged,
}: {
  step: GoalStepRow;
  members: FamilyMemberRow[];
  today: IsoDate;
  onChanged: () => void;
}) {
  const [done, setDone] = useState(step.done_at !== null);
  const assignee = step.assigned_member_id
    ? members.find((m) => m.id === step.assigned_member_id)
    : undefined;

  async function toggle() {
    const next = !done;
    // Optimista: se tildan varios seguidos y esperar el viaje de cada uno hace
    // que la lista se sienta trabada.
    setDone(next);

    const { error } = await createClient()
      .from("goal_steps")
      // done_by lo sella el trigger del servidor.
      .update({ done_at: next ? new Date().toISOString() : null })
      .eq("id", step.id);

    if (error) {
      setDone(!next);
      toast.error("No se pudo actualizar el paso.");
      return;
    }
    onChanged();
  }

  async function assign(memberId: string) {
    const { error } = await createClient()
      .from("goal_steps")
      .update({ assigned_member_id: memberId || null })
      .eq("id", step.id);

    if (error) {
      toast.error("No se pudo asignar.");
      return;
    }
    onChanged();
  }

  async function remove() {
    const { error } = await createClient().from("goal_steps").delete().eq("id", step.id);
    if (error) {
      toast.error("No se pudo borrar el paso.");
      return;
    }
    onChanged();
  }

  const overdue = !done && step.due_date !== null && step.due_date < today;

  return (
    <li className="flex items-center gap-1">
      <CircleCheckbox
        size="sm"
        checked={done}
        label={`Marcar "${step.title}" como ${done ? "pendiente" : "hecho"}`}
        onClick={toggle}
      />

      <span className="min-w-0 flex-1 py-1.5">
        <span
          className={cn(
            "block truncate text-sm",
            done ? "text-muted line-through" : "text-fg",
          )}
        >
          {step.title}
        </span>
        {step.due_date ? (
          <span
            className={cn(
              "block text-[11px]",
              overdue ? "font-bold text-danger" : "text-muted",
            )}
          >
            {relativeDayLabel(step.due_date, today)}
          </span>
        ) : null}
      </span>

      <span className="relative shrink-0">
        {assignee ? (
          <MemberAvatar member={assignee} size="sm" />
        ) : (
          <span
            aria-hidden
            className="grid size-6 place-items-center rounded-full border border-dashed border-border-strong text-[10px] text-muted"
          >
            ?
          </span>
        )}
        <select
          value={step.assigned_member_id ?? ""}
          onChange={(e) => assign(e.target.value)}
          aria-label={`Quién se encarga de ${step.title}`}
          className="absolute inset-0 cursor-pointer opacity-0"
        >
          <option value="">Sin asignar</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.display_name}
            </option>
          ))}
        </select>
      </span>

      <button
        type="button"
        onClick={remove}
        aria-label={`Borrar el paso ${step.title}`}
        className="grid size-8 shrink-0 place-items-center rounded-full text-muted/40 transition-colors hover:text-danger"
      >
        <Trash2 className="size-3.5" />
      </button>
    </li>
  );
}
