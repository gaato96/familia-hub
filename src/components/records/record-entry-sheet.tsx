"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { todayInAr } from "@/lib/dates";
import {
  parseHeadCircToMm,
  parseHeightToMm,
  parseWeightToGrams,
} from "@/lib/records/measures";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { SizeKind } from "@/types/database";

export type EntryKind = "medication" | "vaccine" | "visit" | "growth" | "milestone" | "size";

const TITLES: Record<EntryKind, string> = {
  medication: "Nuevo medicamento",
  vaccine: "Nueva vacuna",
  visit: "Nueva consulta",
  growth: "Nueva medición",
  milestone: "Nuevo hito",
  size: "Nuevo talle",
};

/**
 * Un solo componente para las seis altas del expediente.
 *
 * Son formularios cortos que comparten la misma mecánica: campos, insert en
 * una tabla, cerrar. Seis archivos casi idénticos serían seis lugares donde
 * corregir el mismo bug de manejo de errores.
 *
 * `family_id` no se manda nunca: lo pone el trigger `set_family_id` a partir
 * de la sesión (migración 20260820130100).
 */
export function RecordEntrySheet({
  kind,
  memberId,
  onClose,
  onSaved,
}: {
  kind: EntryKind | null;
  memberId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  return (
    <Sheet open={kind !== null} onOpenChange={(open) => !open && onClose()}>
      {kind ? (
        <SheetContent title={TITLES[kind]}>
          <EntryForm kind={kind} memberId={memberId} onSaved={onSaved} />
        </SheetContent>
      ) : null}
    </Sheet>
  );
}

function EntryForm({
  kind,
  memberId,
  onSaved,
}: {
  kind: EntryKind;
  memberId: string;
  onSaved: () => void;
}) {
  const today = todayInAr();
  const [values, setValues] = useState<Record<string, string>>({
    date: today,
    sizeKind: "calzado",
  });
  const [pending, setPending] = useState(false);

  const set = (key: string) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setValues((current) => ({ ...current, [key]: event.target.value }));

  const value = (key: string) => values[key] ?? "";

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);

    const supabase = createClient();
    let error: { message: string } | null = null;

    switch (kind) {
      case "medication": {
        ({ error } = await supabase.from("medications").insert({
          member_id: memberId,
          name: value("name").trim(),
          dose: value("dose").trim() || null,
          frequency: value("frequency").trim() || null,
          treats: value("treats").trim() || null,
          prescribed_by: value("prescribedBy").trim() || null,
          notes: value("notes").trim() || null,
          started_on: value("date") || null,
        }));
        break;
      }

      case "vaccine": {
        const applied = value("appliedOn");
        const due = value("dueOn");
        // El CHECK de la base exige al menos una de las dos fechas: si no se
        // valida acá, el usuario recibe un error de Postgres en inglés.
        if (!applied && !due) {
          toast.error("Poné la fecha en que se aplicó, o la fecha en que toca.");
          setPending(false);
          return;
        }
        ({ error } = await supabase.from("vaccines").insert({
          member_id: memberId,
          name: value("name").trim(),
          dose_label: value("doseLabel").trim() || null,
          applied_on: applied || null,
          due_on: due || null,
          place: value("place").trim() || null,
          notes: value("notes").trim() || null,
        }));
        break;
      }

      case "visit": {
        ({ error } = await supabase.from("medical_visits").insert({
          member_id: memberId,
          visited_on: value("date"),
          specialty: value("specialty").trim() || null,
          professional: value("professional").trim() || null,
          place: value("place").trim() || null,
          reason: value("reason").trim() || null,
          diagnosis: value("diagnosis").trim() || null,
          indications: value("indications").trim() || null,
          next_visit_on: value("nextVisit") || null,
        }));
        break;
      }

      case "growth": {
        const weight = value("weight") ? parseWeightToGrams(value("weight")) : null;
        const height = value("height") ? parseHeightToMm(value("height")) : null;
        const head = value("head") ? parseHeadCircToMm(value("head")) : null;

        if (value("weight") && weight === null) {
          toast.error("El peso no parece válido. Poné los kilos, por ejemplo 12,4.");
          setPending(false);
          return;
        }
        if (value("height") && height === null) {
          toast.error("La talla no parece válida. Poné los centímetros, por ejemplo 87.");
          setPending(false);
          return;
        }
        if (weight === null && height === null && head === null) {
          toast.error("Cargá al menos una medida.");
          setPending(false);
          return;
        }

        ({ error } = await supabase.from("growth_records").insert({
          member_id: memberId,
          measured_on: value("date"),
          weight_grams: weight,
          height_mm: height,
          head_circ_mm: head,
          notes: value("notes").trim() || null,
        }));
        break;
      }

      case "milestone": {
        ({ error } = await supabase.from("milestones").insert({
          member_id: memberId,
          title: value("name").trim(),
          achieved_on: value("date"),
          notes: value("notes").trim() || null,
        }));
        break;
      }

      case "size": {
        ({ error } = await supabase.from("member_sizes").insert({
          member_id: memberId,
          kind: (values.sizeKind ?? "calzado") as SizeKind,
          value: value("name").trim(),
          notes: value("notes").trim() || null,
          valid_from: value("date"),
        }));
        break;
      }
    }

    setPending(false);

    if (error) {
      toast.error(
        error.message.toLowerCase().includes("duplicate") ||
          error.message.includes("unique")
          ? "Ya hay una carga para esa fecha."
          : "No se pudo guardar.",
      );
      return;
    }
    onSaved();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {kind === "medication" ? (
        <>
          <Field id="name" label="Nombre del remedio" required autoFocus
            value={value("name")} onChange={set("name")} placeholder="Ibuprofeno pediátrico" />
          <div className="grid grid-cols-2 gap-3">
            <Field id="dose" label="Dosis" value={value("dose")} onChange={set("dose")}
              placeholder="5 ml" />
            <Field id="frequency" label="Cada cuánto" value={value("frequency")}
              onChange={set("frequency")} placeholder="cada 8 horas" />
          </div>
          <Field id="treats" label="Para qué es" value={value("treats")} onChange={set("treats")}
            placeholder="Fiebre y dolor" />
          <Field id="prescribedBy" label="Lo indicó" value={value("prescribedBy")}
            onChange={set("prescribedBy")} placeholder="Dra. Pérez" />
          <Field id="date" label="Desde" type="date" value={value("date")} onChange={set("date")} />
          <TextField id="notes" label="Notas" value={value("notes")} onChange={set("notes")} />
        </>
      ) : null}

      {kind === "vaccine" ? (
        <>
          <Field id="name" label="Vacuna" required autoFocus value={value("name")}
            onChange={set("name")} placeholder="Triple viral" />
          <Field id="doseLabel" label="Dosis" value={value("doseLabel")} onChange={set("doseLabel")}
            placeholder="1ra dosis / refuerzo" />
          <div className="grid grid-cols-2 gap-3">
            <Field id="appliedOn" label="Se aplicó el" type="date" value={value("appliedOn")}
              onChange={set("appliedOn")} />
            <Field id="dueOn" label="Toca el" type="date" value={value("dueOn")}
              onChange={set("dueOn")} />
          </div>
          <Field id="place" label="Dónde" value={value("place")} onChange={set("place")} />
          <TextField id="notes" label="Notas" value={value("notes")} onChange={set("notes")} />
        </>
      ) : null}

      {kind === "visit" ? (
        <>
          <Field id="date" label="Fecha" type="date" required value={value("date")}
            onChange={set("date")} />
          <div className="grid grid-cols-2 gap-3">
            <Field id="specialty" label="Especialidad" autoFocus value={value("specialty")}
              onChange={set("specialty")} placeholder="Pediatría" />
            <Field id="professional" label="Profesional" value={value("professional")}
              onChange={set("professional")} />
          </div>
          <Field id="place" label="Dónde" value={value("place")} onChange={set("place")} />
          <Field id="reason" label="Motivo" value={value("reason")} onChange={set("reason")} />
          <TextField id="diagnosis" label="Diagnóstico" value={value("diagnosis")}
            onChange={set("diagnosis")} />
          <TextField id="indications" label="Indicaciones" value={value("indications")}
            onChange={set("indications")} />
          <Field id="nextVisit" label="Próxima consulta" type="date" value={value("nextVisit")}
            onChange={set("nextVisit")} />
        </>
      ) : null}

      {kind === "growth" ? (
        <>
          <Field id="date" label="Fecha de la medición" type="date" required value={value("date")}
            onChange={set("date")} />
          <div className="grid grid-cols-2 gap-3">
            <Field id="weight" label="Peso (kg)" inputMode="decimal" autoFocus
              value={value("weight")} onChange={set("weight")} placeholder="12,4" />
            <Field id="height" label="Talla (cm)" inputMode="decimal" value={value("height")}
              onChange={set("height")} placeholder="87" />
          </div>
          <Field id="head" label="Perímetro cefálico (cm)" inputMode="decimal" value={value("head")}
            onChange={set("head")} />
          <TextField id="notes" label="Notas" value={value("notes")} onChange={set("notes")} />
        </>
      ) : null}

      {kind === "milestone" ? (
        <>
          <Field id="name" label="Qué logró" required autoFocus value={value("name")}
            onChange={set("name")} placeholder="Dio sus primeros pasos" />
          <Field id="date" label="Cuándo" type="date" required value={value("date")}
            onChange={set("date")} />
          <TextField id="notes" label="Notas" value={value("notes")} onChange={set("notes")} />
        </>
      ) : null}

      {kind === "size" ? (
        <>
          <fieldset>
            <Label>Tipo</Label>
            <div className="flex flex-wrap gap-1.5">
              {(["calzado", "ropa", "pantalon", "abrigo", "otro"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setValues((c) => ({ ...c, sizeKind: k }))}
                  aria-pressed={values.sizeKind === k}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-medium capitalize",
                    values.sizeKind === k
                      ? "border-primary bg-primary text-primary-fg"
                      : "border-border text-muted",
                  )}
                >
                  {k}
                </button>
              ))}
            </div>
          </fieldset>
          <Field id="name" label="Talle" required autoFocus value={value("name")}
            onChange={set("name")} placeholder="26" />
          <Field id="date" label="Desde" type="date" value={value("date")} onChange={set("date")} />
          <TextField id="notes" label="Notas" value={value("notes")} onChange={set("notes")} />
        </>
      ) : null}

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Guardando..." : "Guardar"}
      </Button>
    </form>
  );
}

function Field({
  id,
  label,
  ...props
}: { id: string; label: string } & React.ComponentProps<"input">) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} {...props} />
    </div>
  );
}

function TextField({
  id,
  label,
  ...props
}: { id: string; label: string } & React.ComponentProps<"textarea">) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Textarea id={id} rows={2} {...props} />
    </div>
  );
}
