"use client";

import { Plus, StickyNote } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { NoteCard } from "@/components/board/note-card";
import { NoteComposer } from "@/components/board/note-composer";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/card";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useNotesRealtime } from "@/hooks/use-notes-realtime";
import type { Note } from "@/lib/notes/queries";
import { createClient } from "@/lib/supabase/client";
import type { FamilyMemberRow } from "@/types/database";

/**
 * El tablero. Escribe directo contra Supabase desde el cliente en vez de pasar
 * por una Server Action: RLS ya autoriza cada fila, y el viaje corto es lo que
 * hace que pegar una nota se sienta instantáneo. Una Server Action agregaría
 * un salto al server y una revalidación de ruta para el mismo resultado.
 */
export function FridgeBoard({
  initialNotes,
  members,
  currentMemberId,
  isParent,
}: {
  initialNotes: Note[];
  members: FamilyMemberRow[];
  currentMemberId: string;
  isParent: boolean;
}) {
  const { notes, setNotes, refetch } = useNotesRealtime(initialNotes);
  const [composerOpen, setComposerOpen] = useState(false);

  const byId = new Map(members.map((m) => [m.id, m]));

  async function togglePin(note: Note) {
    // Optimista: el tablero responde al toque y el refetch de Realtime deja el
    // orden definitivo un instante después.
    setNotes((current) =>
      current.map((n) => (n.id === note.id ? { ...n, is_pinned: !n.is_pinned } : n)),
    );

    const { error } = await createClient()
      .from("notes")
      .update({ is_pinned: !note.is_pinned })
      .eq("id", note.id);

    if (error) {
      toast.error("No se pudo fijar la nota.");
      void refetch();
    }
  }

  async function remove(note: Note) {
    setNotes((current) => current.filter((n) => n.id !== note.id));

    const { error } = await createClient().from("notes").delete().eq("id", note.id);

    if (error) {
      toast.error("No se pudo sacar la nota.");
      void refetch();
    }
  }

  return (
    <>
      <section aria-label="Notas de la familia" className="rounded-app bg-board p-3">
        {notes.length === 0 ? (
          <EmptyState
            icon={<StickyNote className="size-8" />}
            title="La heladera está vacía"
            hint="Pegá un papelito y lo van a ver todos los de la casa."
            action={
              <Button onClick={() => setComposerOpen(true)} size="sm">
                <Plus /> Pegar una nota
              </Button>
            }
          />
        ) : (
          // Columnas CSS y no grid: las notas tienen alturas distintas y con
          // grid quedan huecos enormes debajo de las cortas.
          <div className="columns-2 gap-3 [&>*]:mb-3">
            {notes.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                author={byId.get(note.author_member_id)}
                canDelete={isParent || note.author_member_id === currentMemberId}
                onTogglePin={togglePin}
                onDelete={remove}
              />
            ))}
          </div>
        )}
      </section>

      {notes.length > 0 ? (
        <Button
          onClick={() => setComposerOpen(true)}
          variant="outline"
          className="mt-3 w-full border-dashed"
        >
          <Plus /> Pegar una nota
        </Button>
      ) : null}

      <Sheet open={composerOpen} onOpenChange={setComposerOpen}>
        <SheetContent title="Nueva nota" description="La ven todos los de la casa.">
          <NoteComposer
            onDone={() => {
              setComposerOpen(false);
              void refetch();
            }}
          />
        </SheetContent>
      </Sheet>
    </>
  );
}
