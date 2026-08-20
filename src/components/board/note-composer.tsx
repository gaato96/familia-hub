"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { NOTE_COLORS } from "@/lib/notes/queries";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { NoteColor } from "@/types/database";

const COLOR_KEYS = Object.keys(NOTE_COLORS) as NoteColor[];

/** Coincide con el CHECK de `notes.body` en la base. */
const MAX_LENGTH = 500;

export function NoteComposer({ onDone }: { onDone: () => void }) {
  const [body, setBody] = useState("");
  const [color, setColor] = useState<NoteColor>("yellow");
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const text = body.trim();
    if (!text) return;

    setPending(true);
    const { error } = await createClient()
      .from("notes")
      .insert({
        // Ni family_id ni author_member_id se mandan desde acá: los pone la
        // base a partir de la sesión (trigger set_family_id / set_author_member,
        // migración 20260820121100). El cliente nunca decide de qué familia es
        // una fila.
        body: text,
        color,
      });

    setPending(false);

    if (error) {
      toast.error("No se pudo pegar la nota.");
      return;
    }
    setBody("");
    onDone();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value.slice(0, MAX_LENGTH))}
        rows={4}
        autoFocus
        required
        placeholder="Comprar pan. Llamar a la pediatra. Te quiero."
        style={{ backgroundColor: NOTE_COLORS[color].bg, color: NOTE_COLORS[color].ink }}
        // Se escribe con la misma letra con la que se va a ver: lo que se
        // tipea ya parece el papelito final.
        className="font-hand text-2xl leading-snug"
      />

      <fieldset>
        <legend className="mb-2 text-sm font-medium text-muted">Color del papel</legend>
        <div className="flex gap-2">
          {COLOR_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setColor(key)}
              aria-label={NOTE_COLORS[key].label}
              aria-pressed={color === key}
              style={{ backgroundColor: NOTE_COLORS[key].bg }}
              className={cn(
                "size-10 rounded-full border-2 transition-transform",
                color === key ? "scale-110 border-fg" : "border-transparent",
              )}
            />
          ))}
        </div>
      </fieldset>

      <Button type="submit" size="lg" className="w-full" disabled={pending || !body.trim()}>
        {pending ? "Pegando..." : "Pegar en la heladera"}
      </Button>
    </form>
  );
}
