"use client";

import { Plus, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ChoiceChip } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { GOAL_CATEGORIES } from "@/lib/goals/progress";
import { createClient } from "@/lib/supabase/client";
import type { FamilyMemberRow, GoalCategory, GoalRow } from "@/types/database";

/**
 * Alta y edición de un objetivo.
 *
 * Al crear se pueden cargar los primeros pasos en la misma pantalla, y eso es
 * deliberado: un objetivo sin pasos es un deseo, y si cargarlos costara otra
 * pantalla más, la mitad se quedaría sin ninguno. Al editar, en cambio, los
 * pasos se manejan en la tarjeta —que es donde se los tilda.
 */
export function GoalForm({
  members,
  goal,
  onDone,
}: {
  members: FamilyMemberRow[];
  goal?: GoalRow;
  onDone: () => void;
}) {
  const [title, setTitle] = useState(goal?.title ?? "");
  const [detail, setDetail] = useState(goal?.detail ?? "");
  const [category, setCategory] = useState<GoalCategory>(goal?.category ?? "casa");
  const [ownerId, setOwnerId] = useState<string | null>(goal?.owner_member_id ?? null);
  const [targetDate, setTargetDate] = useState(goal?.target_date ?? "");
  const [steps, setSteps] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);

  function addStep() {
    const clean = draft.trim();
    if (!clean) return;
    setSteps((current) => [...current, clean]);
    setDraft("");
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);

    const payload = {
      title: title.trim(),
      detail: detail.trim() || null,
      category,
      owner_member_id: ownerId,
      target_date: targetDate || null,
    };

    const supabase = createClient();

    if (goal) {
      const { error } = await supabase.from("goals").update(payload).eq("id", goal.id);
      setPending(false);
      if (error) {
        toast.error("No se pudo guardar el objetivo.");
        return;
      }
      onDone();
      return;
    }

    const { data, error } = await supabase
      .from("goals")
      .insert(payload)
      .select("id")
      .single();

    if (error || !data) {
      setPending(false);
      toast.error("No se pudo crear el objetivo.");
      return;
    }

    if (steps.length > 0) {
      // Todas las filas con las mismas claves: PostgREST manda NULL explícito
      // donde falte una en vez de dejar actuar al DEFAULT. Ver CLAUDE.md.
      const { error: stepsError } = await supabase.from("goal_steps").insert(
        steps.map((step, index) => ({
          goal_id: data.id,
          title: step,
          position: index,
        })),
      );

      if (stepsError) {
        setPending(false);
        toast.error("El objetivo se guardó, pero los pasos no.");
        onDone();
        return;
      }
    }

    setPending(false);
    onDone();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <Label htmlFor="goalTitle">Qué queremos lograr</Label>
        <Input
          id="goalTitle"
          required
          autoFocus
          maxLength={140}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Dejar el garage usable"
        />
      </div>

      <fieldset>
        <Label>De qué se trata</Label>
        <div className="flex flex-wrap gap-1.5">
          {GOAL_CATEGORIES.map((c) => (
            <ChoiceChip
              key={c.value}
              selected={category === c.value}
              onClick={() => setCategory(c.value)}
            >
              {c.label}
            </ChoiceChip>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <Label>De quién es</Label>
        <div className="flex flex-wrap gap-1.5">
          <ChoiceChip selected={ownerId === null} onClick={() => setOwnerId(null)}>
            De toda la casa
          </ChoiceChip>
          {members.map((m) => (
            <ChoiceChip
              key={m.id}
              selected={ownerId === m.id}
              onClick={() => setOwnerId(m.id)}
            >
              {m.display_name.split(" ")[0]}
            </ChoiceChip>
          ))}
        </div>
      </fieldset>

      <div>
        <Label htmlFor="goalDate">Para cuándo (opcional)</Label>
        <Input
          id="goalDate"
          type="date"
          value={targetDate}
          onChange={(e) => setTargetDate(e.target.value)}
        />
        <p className="mt-1 text-xs text-muted">
          Con fecha aparece antes en la lista y avisa cuando se acerca.
        </p>
      </div>

      {!goal ? (
        <fieldset>
          <Label>Primeros pasos</Label>

          {steps.length > 0 ? (
            <ul className="mb-2 space-y-1">
              {steps.map((step, index) => (
                <li
                  key={`${step}-${index}`}
                  className="flex items-center gap-2 rounded-app-sm bg-surface-2 px-3 py-2 text-sm"
                >
                  <span className="min-w-0 flex-1 truncate text-fg">{step}</span>
                  <button
                    type="button"
                    onClick={() => setSteps((c) => c.filter((_, i) => i !== index))}
                    aria-label={`Quitar ${step}`}
                    className="grid size-7 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-3"
                  >
                    <X className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          <div className="flex gap-1.5">
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                // Enter agrega el paso, no manda el objetivo a medio armar.
                if (e.key === "Enter") {
                  e.preventDefault();
                  addStep();
                }
              }}
              placeholder="Sacar las cajas del fondo"
              aria-label="Paso"
              className="flex-1"
            />
            <Button
              type="button"
              variant="soft"
              size="icon"
              onClick={addStep}
              aria-label="Agregar paso"
            >
              <Plus />
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted">
            Un objetivo sin pasos es un deseo. Después se les pone nombre y fecha.
          </p>
        </fieldset>
      ) : null}

      <div>
        <Label htmlFor="goalDetail">Notas (opcional)</Label>
        <Textarea
          id="goalDetail"
          rows={2}
          value={detail}
          onChange={(e) => setDetail(e.target.value)}
        />
      </div>

      <Button type="submit" size="lg" className="w-full" disabled={pending || !title.trim()}>
        {pending ? "Guardando..." : goal ? "Guardar cambios" : "Crear objetivo"}
      </Button>
    </form>
  );
}
