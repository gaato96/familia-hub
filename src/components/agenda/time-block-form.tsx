"use client";

import { Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ChoiceChip } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { TIME_BLOCK_KINDS } from "@/lib/agenda/blocks";
import { isoWeekday, type IsoDate } from "@/lib/dates";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { FamilyMemberRow, TimeBlockKind, TimeBlockRow } from "@/types/database";

/**
 * Los siete botones de día.
 *
 * `label` es la inicial que se dibuja y `name` es lo que escucha un lector de
 * pantalla: "L" y "M" solos no distinguen lunes de martes de miércoles, y con
 * dos "M" seguidas la fila es directamente indescifrable sin ver.
 */
const WEEKDAYS = [
  { value: 1, label: "L", name: "lunes" },
  { value: 2, label: "M", name: "martes" },
  { value: 3, label: "M", name: "miércoles" },
  { value: 4, label: "J", name: "jueves" },
  { value: 5, label: "V", name: "viernes" },
  { value: 6, label: "S", name: "sábado" },
  { value: 7, label: "D", name: "domingo" },
];

/** El `time` de Postgres viene con segundos; el input los rechaza. */
function toInputTime(value: string): string {
  return value.slice(0, 5);
}

export function TimeBlockForm({
  members,
  date,
  block,
  onDone,
}: {
  members: FamilyMemberRow[];
  /** La fecha que se está mirando: es el día por defecto de un bloque puntual. */
  date: IsoDate;
  /** Presente = edición. */
  block?: TimeBlockRow;
  onDone: () => void;
}) {
  const [title, setTitle] = useState(block?.title ?? "");
  const [memberId, setMemberId] = useState<string | null>(block?.member_id ?? null);
  const [kind, setKind] = useState<TimeBlockKind>(block?.kind ?? "otro");
  const [startsAt, setStartsAt] = useState(toInputTime(block?.starts_at ?? "09:00"));
  const [endsAt, setEndsAt] = useState(toInputTime(block?.ends_at ?? "10:00"));
  const [repeats, setRepeats] = useState(block ? block.weekdays !== null : true);
  const [weekdays, setWeekdays] = useState<number[]>(
    block?.weekdays ?? [isoWeekday(date)],
  );
  const [onDate, setOnDate] = useState<string>(block?.on_date ?? date);
  const [notes, setNotes] = useState(block?.notes ?? "");
  const [pending, setPending] = useState(false);

  const invalidSpan = endsAt <= startsAt;
  const noWeekdays = repeats && weekdays.length === 0;

  function toggleWeekday(value: number) {
    setWeekdays((current) =>
      current.includes(value)
        ? current.filter((d) => d !== value)
        : [...current, value].sort((a, b) => a - b),
    );
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (invalidSpan || noWeekdays) return;
    setPending(true);

    const payload = {
      title: title.trim(),
      member_id: memberId,
      kind,
      starts_at: startsAt,
      ends_at: endsAt,
      // O días de semana o una fecha, nunca los dos: lo garantiza un CHECK, y
      // mandar los dos haría fallar el insert entero.
      weekdays: repeats ? weekdays : null,
      on_date: repeats ? null : onDate,
      notes: notes.trim() || null,
    };

    const supabase = createClient();
    const { error } = block
      ? await supabase.from("time_blocks").update(payload).eq("id", block.id)
      : await supabase.from("time_blocks").insert(payload);

    setPending(false);

    if (error) {
      toast.error(
        error.message.includes("time_blocks_span")
          ? "Un bloque no puede cruzar la medianoche. Cargalo en dos."
          : "No se pudo guardar el bloque.",
      );
      return;
    }
    onDone();
  }

  async function remove() {
    if (!block) return;
    setPending(true);
    const { error } = await createClient().from("time_blocks").delete().eq("id", block.id);
    setPending(false);

    if (error) {
      toast.error("No se pudo borrar.");
      return;
    }
    toast.success("Bloque borrado.");
    onDone();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <Label htmlFor="blockTitle">Qué es</Label>
        <Input
          id="blockTitle"
          required
          autoFocus
          maxLength={80}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Trabajo de mamá"
        />
      </div>

      <fieldset>
        <Label>De quién</Label>
        <div className="flex flex-wrap gap-1.5">
          <ChoiceChip selected={memberId === null} onClick={() => setMemberId(null)}>
            Toda la casa
          </ChoiceChip>
          {members.map((m) => (
            <ChoiceChip
              key={m.id}
              selected={memberId === m.id}
              onClick={() => setMemberId(m.id)}
            >
              {m.display_name.split(" ")[0]}
            </ChoiceChip>
          ))}
        </div>
        <p className="mt-1.5 text-xs text-muted">
          &ldquo;Toda la casa&rdquo; para el almuerzo o la cena; una persona para su trabajo o
          su clase.
        </p>
      </fieldset>

      <fieldset>
        <Label>Tipo</Label>
        <div className="flex flex-wrap gap-1.5">
          {TIME_BLOCK_KINDS.map((k) => (
            <ChoiceChip key={k.value} selected={kind === k.value} onClick={() => setKind(k.value)}>
              {k.label}
            </ChoiceChip>
          ))}
        </div>
      </fieldset>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="blockStart">Desde</Label>
          <Input
            id="blockStart"
            type="time"
            required
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="blockEnd">Hasta</Label>
          <Input
            id="blockEnd"
            type="time"
            required
            value={endsAt}
            onChange={(e) => setEndsAt(e.target.value)}
            aria-invalid={invalidSpan}
          />
        </div>
      </div>

      {invalidSpan ? (
        <p className="-mt-2 text-xs font-semibold text-danger">
          Tiene que terminar después de empezar. Un turno noche se carga en dos bloques.
        </p>
      ) : null}

      <fieldset>
        <Label>Cuándo</Label>
        <div className="mb-2 flex gap-1.5">
          <ChoiceChip selected={repeats} onClick={() => setRepeats(true)} className="flex-1">
            Todas las semanas
          </ChoiceChip>
          <ChoiceChip selected={!repeats} onClick={() => setRepeats(false)} className="flex-1">
            Un día puntual
          </ChoiceChip>
        </div>

        {repeats ? (
          <>
            <div className="flex gap-1">
              {WEEKDAYS.map((d) => (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => toggleWeekday(d.value)}
                  aria-pressed={weekdays.includes(d.value)}
                  aria-label={d.name}
                  className={cn(
                    "h-11 flex-1 rounded-app-sm font-display text-sm font-bold transition-colors",
                    weekdays.includes(d.value)
                      ? "bg-primary text-primary-fg"
                      : "bg-surface-2 text-muted",
                  )}
                >
                  {d.label}
                </button>
              ))}
            </div>
            {noWeekdays ? (
              <p className="mt-1.5 text-xs font-semibold text-danger">
                Elegí al menos un día.
              </p>
            ) : null}
          </>
        ) : (
          <Input
            type="date"
            value={onDate}
            onChange={(e) => setOnDate(e.target.value)}
            aria-label="Fecha del bloque"
          />
        )}
      </fieldset>

      <div>
        <Label htmlFor="blockNotes">Nota (opcional)</Label>
        <Textarea
          id="blockNotes"
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Los martes es por videollamada"
        />
      </div>

      <div className="flex gap-2">
        {block ? (
          <Button
            type="button"
            variant="ghost"
            size="lg"
            onClick={remove}
            disabled={pending}
            aria-label="Borrar bloque"
            className="text-danger"
          >
            <Trash2 />
          </Button>
        ) : null}
        <Button
          type="submit"
          size="lg"
          className="flex-1"
          disabled={pending || !title.trim() || invalidSpan || noWeekdays}
        >
          {pending ? "Guardando..." : block ? "Guardar cambios" : "Agregar bloque"}
        </Button>
      </div>
    </form>
  );
}
