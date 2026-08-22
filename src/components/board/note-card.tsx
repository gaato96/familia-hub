"use client";

import { Pin, Trash2 } from "lucide-react";

import { NOTE_COLORS, rotationFor, type Note } from "@/lib/notes/queries";
import { relativeDayLabel } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { FamilyMemberRow } from "@/types/database";

export function NoteCard({
  note,
  author,
  canDelete,
  onTogglePin,
  onDelete,
}: {
  note: Note;
  author: FamilyMemberRow | undefined;
  canDelete: boolean;
  onTogglePin: (note: Note) => void;
  onDelete: (note: Note) => void;
}) {
  const palette = NOTE_COLORS[note.color];

  /**
   * Las acciones se llamaban "Fijar nota" y "Sacar nota" a secas. Con cinco
   * papelitos en la heladera, un lector de pantalla lee cinco veces lo mismo y
   * no hay forma de saber cuál se está por sacar. El cuerpo recortado alcanza
   * para distinguirlas sin volver la etiqueta interminable.
   */
  const resumen = note.body.length > 30 ? `${note.body.slice(0, 30)}…` : note.body;
  // La inclinación sale del id, no de un random por render: si cambiara en cada
  // actualización, todo el tablero temblaría cada 30 segundos con el poll.
  const tilt = note.is_pinned ? 0 : rotationFor(note.id);

  return (
    <article
      style={{
        backgroundColor: palette.bg,
        color: palette.ink,
        transform: `rotate(${tilt}deg)`,
      }}
      className={cn(
        "relative break-inside-avoid rounded-sm p-3.5 shadow-md transition-transform",
        // Sombra más marcada arriba a la izquierda: es lo que hace que se lea
        // como un papel apoyado y no como una tarjeta plana de UI.
        "shadow-[2px_3px_8px_rgba(0,0,0,0.16)]",
      )}
    >
      {note.is_pinned ? (
        <Pin
          aria-label="Fijada"
          className="absolute -top-2 left-1/2 size-5 -translate-x-1/2 rotate-[20deg] fill-red-500 stroke-red-700"
        />
      ) : null}

      <p className="whitespace-pre-wrap break-words font-hand text-xl leading-snug">
        {note.body}
      </p>

      <footer className="mt-3 flex items-center justify-between gap-2 text-[11px] opacity-70">
        <span className="truncate font-semibold">
          {author?.display_name ?? "Alguien"} · {relativeDayLabel(note.created_at.slice(0, 10))}
        </span>

        <span className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            onClick={() => onTogglePin(note)}
            aria-label={`${note.is_pinned ? "Desfijar" : "Fijar"} la nota "${resumen}"`}
            aria-pressed={note.is_pinned}
            className="grid size-7 place-items-center rounded-full hover:bg-black/10"
          >
            <Pin className={cn("size-3.5", note.is_pinned && "fill-current")} />
          </button>

          {canDelete ? (
            <button
              type="button"
              onClick={() => onDelete(note)}
              aria-label={`Sacar la nota "${resumen}"`}
              className="grid size-7 place-items-center rounded-full hover:bg-black/10"
            >
              <Trash2 className="size-3.5" />
            </button>
          ) : null}
        </span>
      </footer>
    </article>
  );
}
