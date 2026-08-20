"use client";

import { Plus, X } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { MemberAvatar } from "@/components/app/member-chip";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { addDaysIso, formatDayLabel, type IsoDate } from "@/lib/dates";
import { describeRecurrence, occurrencesBetween } from "@/lib/tasks/recurrence";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type {
  FamilyMemberRow,
  Recurrence,
  TaskCategory,
  TaskPriority,
  TaskStepKind,
} from "@/types/database";

const CATEGORIES: { value: TaskCategory; label: string }[] = [
  { value: "limpieza", label: "Limpieza" },
  { value: "hogar", label: "Casa" },
  { value: "cocina", label: "Cocina" },
  { value: "compras", label: "Compras" },
  { value: "tramites", label: "Trámites" },
  { value: "julian", label: "Julián" },
  { value: "otros", label: "Otros" },
];

const WEEKDAYS = [
  { value: 1, label: "L" },
  { value: 2, label: "M" },
  { value: 3, label: "X" },
  { value: 4, label: "J" },
  { value: 5, label: "V" },
  { value: 6, label: "S" },
  { value: 0, label: "D" },
];

type RepeatMode = "once" | "days" | "weekly" | "monthly";
type DraftStep = { label: string; kind: TaskStepKind };

export function TaskForm({
  members,
  defaultDate,
  onDone,
}: {
  members: FamilyMemberRow[];
  defaultDate: IsoDate;
  onDone: () => void;
}) {
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [category, setCategory] = useState<TaskCategory>("limpieza");
  const [priority, setPriority] = useState<TaskPriority>("normal");
  const [startsOn, setStartsOn] = useState<IsoDate>(defaultDate);
  const [mode, setMode] = useState<RepeatMode>("once");
  const [interval, setIntervalDays] = useState(15);
  const [weekdays, setWeekdays] = useState<number[]>([1]);
  const [monthDay, setMonthDay] = useState(1);
  const [rotation, setRotation] = useState<string[]>([]);
  const [steps, setSteps] = useState<DraftStep[]>([]);
  const [pending, setPending] = useState(false);

  const recurrence = buildRecurrence(mode, { interval, weekdays, monthDay });

  // Previsualización con la MISMA función que usa el planner. Que el usuario
  // vea las fechas reales antes de guardar es lo que evita crear "cada 15 días"
  // creyendo que era quincenal-los-lunes.
  const preview = useMemo(
    () =>
      occurrencesBetween(recurrence, {
        startsOn,
        until: addDaysIso(startsOn, 90),
        limit: 4,
      }),
    [recurrence, startsOn],
  );

  function toggleWeekday(day: number) {
    setWeekdays((current) =>
      current.includes(day)
        ? current.filter((d) => d !== day)
        : [...current, day].sort((a, b) => a - b),
    );
  }

  function toggleRotation(memberId: string) {
    setRotation((current) =>
      current.includes(memberId)
        ? current.filter((id) => id !== memberId)
        : [...current, memberId],
    );
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (mode === "weekly" && weekdays.length === 0) {
      toast.error("Elegí al menos un día de la semana.");
      return;
    }

    setPending(true);
    const supabase = createClient();

    // family_id y created_by_member_id los pone la base (trigger de la
    // migración 20260820121100).
    const { data, error } = await supabase
      .from("tasks")
      .insert({
        title: title.trim(),
        notes: notes.trim() || null,
        category,
        priority,
        starts_on: startsOn,
        recurrence,
        rotation_member_ids: rotation,
      })
      .select("id")
      .single();

    if (error || !data) {
      setPending(false);
      toast.error("No se pudo crear la tarea.");
      return;
    }

    const cleanSteps = steps.filter((s) => s.label.trim());
    if (cleanSteps.length > 0) {
      await supabase.from("task_steps").insert(
        cleanSteps.map((step, index) => ({
          task_id: data.id,
          label: step.label.trim(),
          kind: step.kind,
          position: index,
        })),
      );
    }

    // Materializa las ocurrencias ya mismo: sin esto, una tarea recurrente
    // creada hoy no aparece en el planner hasta la próxima carga que la genere.
    await supabase.rpc("ensure_task_instances", { p_until: addDaysIso(startsOn, 90) });

    setPending(false);
    onDone();
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div>
        <Label htmlFor="title">¿Qué hay que hacer?</Label>
        <Input
          id="title"
          required
          autoFocus
          maxLength={120}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Lavar las sábanas"
        />
      </div>

      <div>
        <Label>Categoría</Label>
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map((c) => (
            <Chip
              key={c.value}
              active={category === c.value}
              onClick={() => setCategory(c.value)}
            >
              {c.label}
            </Chip>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="startsOn">Empieza</Label>
          <Input
            id="startsOn"
            type="date"
            required
            value={startsOn}
            onChange={(e) => setStartsOn(e.target.value as IsoDate)}
          />
        </div>
        <div>
          <Label>Prioridad</Label>
          <div className="flex gap-1.5">
            {(["baja", "normal", "alta"] as const).map((p) => (
              <Chip key={p} active={priority === p} onClick={() => setPriority(p)}>
                {p}
              </Chip>
            ))}
          </div>
        </div>
      </div>

      <fieldset>
        <Label>Se repite</Label>
        <div className="flex flex-wrap gap-1.5">
          <Chip active={mode === "once"} onClick={() => setMode("once")}>
            Una vez
          </Chip>
          <Chip active={mode === "days"} onClick={() => setMode("days")}>
            Cada N días
          </Chip>
          <Chip active={mode === "weekly"} onClick={() => setMode("weekly")}>
            Días fijos
          </Chip>
          <Chip active={mode === "monthly"} onClick={() => setMode("monthly")}>
            Mensual
          </Chip>
        </div>

        {mode === "days" ? (
          <div className="mt-3 flex items-center gap-2">
            <span className="text-sm text-muted">Cada</span>
            <Input
              type="number"
              min={1}
              max={365}
              value={interval}
              onChange={(e) => setIntervalDays(Number(e.target.value))}
              className="w-20 text-center"
            />
            <span className="text-sm text-muted">días</span>
          </div>
        ) : null}

        {mode === "weekly" ? (
          <div className="mt-3 flex gap-1.5">
            {WEEKDAYS.map((d) => (
              <button
                key={d.value}
                type="button"
                onClick={() => toggleWeekday(d.value)}
                aria-pressed={weekdays.includes(d.value)}
                className={cn(
                  "size-10 rounded-full border text-sm font-semibold",
                  weekdays.includes(d.value)
                    ? "border-primary bg-primary text-primary-fg"
                    : "border-border text-muted",
                )}
              >
                {d.label}
              </button>
            ))}
          </div>
        ) : null}

        {mode === "monthly" ? (
          <div className="mt-3 flex items-center gap-2">
            <span className="text-sm text-muted">El día</span>
            <Input
              type="number"
              min={1}
              max={31}
              value={monthDay}
              onChange={(e) => setMonthDay(Number(e.target.value))}
              className="w-20 text-center"
            />
            <span className="text-sm text-muted">de cada mes</span>
          </div>
        ) : null}

        {preview.length > 0 ? (
          <p className="mt-3 text-xs text-muted">
            <span className="font-semibold capitalize">{describeRecurrence(recurrence)}</span>
            {" · "}
            {preview.map(formatDayLabel).join(" · ")}
            {recurrence ? "..." : ""}
          </p>
        ) : null}
      </fieldset>

      <fieldset>
        <Label>¿Quién la hace?</Label>
        <div className="flex flex-wrap gap-1.5">
          {members.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => toggleRotation(m.id)}
              aria-pressed={rotation.includes(m.id)}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs font-medium",
                rotation.includes(m.id)
                  ? "border-primary bg-primary/10 text-fg"
                  : "border-border text-muted",
              )}
            >
              <MemberAvatar member={m} size="sm" />
              {m.display_name}
            </button>
          ))}
        </div>
        {rotation.length > 1 ? (
          <p className="mt-2 text-xs text-muted">
            Va a rotar en ese orden: {rotation.length} personas, una por vez.
          </p>
        ) : null}
      </fieldset>

      <StepsEditor steps={steps} onChange={setSteps} />

      <div>
        <Label htmlFor="notes">Notas</Label>
        <Textarea
          id="notes"
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Lo que convenga recordar"
        />
      </div>

      <Button type="submit" size="lg" className="w-full" disabled={pending || !title.trim()}>
        {pending ? "Guardando..." : "Crear tarea"}
      </Button>
    </form>
  );
}

/** Editor del "qué hacer / qué no hacer". */
function StepsEditor({
  steps,
  onChange,
}: {
  steps: DraftStep[];
  onChange: (steps: DraftStep[]) => void;
}) {
  const [draft, setDraft] = useState("");
  const [kind, setKind] = useState<TaskStepKind>("do");

  function add() {
    if (!draft.trim()) return;
    onChange([...steps, { label: draft.trim(), kind }]);
    setDraft("");
  }

  return (
    <fieldset>
      <Label>Pasos y advertencias</Label>

      {steps.length > 0 ? (
        <ul className="mb-2 space-y-1">
          {steps.map((step, index) => (
            <li
              key={`${step.label}-${index}`}
              className="flex items-center gap-2 rounded-lg bg-surface-2 px-2.5 py-1.5 text-sm"
            >
              <span
                className={cn(
                  "shrink-0 text-xs font-bold",
                  step.kind === "do" ? "text-success" : "text-danger",
                )}
              >
                {step.kind === "do" ? "SÍ" : "NO"}
              </span>
              <span className="min-w-0 flex-1 truncate text-fg">{step.label}</span>
              <button
                type="button"
                onClick={() => onChange(steps.filter((_, i) => i !== index))}
                aria-label={`Quitar "${step.label}"`}
                className="grid size-7 shrink-0 place-items-center rounded-full text-muted hover:bg-border"
              >
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="flex gap-1.5">
        <div className="flex overflow-hidden rounded-app border border-border">
          {(["do", "dont"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              aria-pressed={kind === k}
              className={cn(
                "px-2.5 text-xs font-bold",
                kind === k
                  ? k === "do"
                    ? "bg-success text-white"
                    : "bg-danger text-white"
                  : "text-muted",
              )}
            >
              {k === "do" ? "SÍ" : "NO"}
            </button>
          ))}
        </div>
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            // Enter agrega el paso, no envía el formulario entero: si no, al
            // tipear el primer paso se crearía la tarea a medio armar.
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder={kind === "do" ? "Pasar trapo con vinagre" : "No usar lavandina"}
          className="flex-1"
        />
        <Button type="button" variant="secondary" size="icon" onClick={add} aria-label="Agregar paso">
          <Plus />
        </Button>
      </div>
    </fieldset>
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
        "rounded-full border px-3 py-1.5 text-xs font-medium capitalize",
        active ? "border-primary bg-primary text-primary-fg" : "border-border text-muted",
      )}
    >
      {children}
    </button>
  );
}

function buildRecurrence(
  mode: RepeatMode,
  values: { interval: number; weekdays: number[]; monthDay: number },
): Recurrence | null {
  switch (mode) {
    case "once":
      return null;
    case "days":
      return { freq: "days", interval: Math.max(1, Math.min(365, values.interval)) };
    case "weekly":
      return { freq: "weekly", byweekday: values.weekdays };
    case "monthly":
      return { freq: "monthly", bymonthday: Math.max(1, Math.min(31, values.monthDay)) };
  }
}
