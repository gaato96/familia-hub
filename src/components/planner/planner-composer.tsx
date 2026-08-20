"use client";

import { useState } from "react";

import { EventForm } from "@/components/planner/event-form";
import { TaskForm } from "@/components/planner/task-form";
import type { IsoDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { FamilyMemberRow } from "@/types/database";

/**
 * Tarea o evento, en la misma hoja.
 *
 * Son cosas distintas (una se completa y rota, la otra solo ocurre) pero se
 * crean desde el mismo botón porque el que las va a cargar no piensa "voy a
 * crear una entidad de tipo evento": piensa "hay que anotar el pediatra".
 */
export function PlannerComposer({
  members,
  defaultDate,
  onDone,
}: {
  members: FamilyMemberRow[];
  currentMemberId: string;
  defaultDate: IsoDate;
  onDone: () => void;
}) {
  const [tab, setTab] = useState<"tarea" | "evento">("tarea");

  return (
    <div className="space-y-4">
      <div
        role="tablist"
        aria-label="Qué agregar"
        className="grid grid-cols-2 gap-1 rounded-app bg-surface-2 p-1"
      >
        {(["tarea", "evento"] as const).map((value) => (
          <button
            key={value}
            role="tab"
            type="button"
            aria-selected={tab === value}
            onClick={() => setTab(value)}
            className={cn(
              "rounded-[calc(var(--radius)-0.25rem)] py-2.5 text-sm capitalize",
              tab === value
                ? "bg-surface font-semibold text-fg shadow-sm"
                : "font-medium text-muted",
            )}
          >
            {value}
          </button>
        ))}
      </div>

      {tab === "tarea" ? (
        <TaskForm members={members} defaultDate={defaultDate} onDone={onDone} />
      ) : (
        <EventForm members={members} defaultDate={defaultDate} onDone={onDone} />
      )}
    </div>
  );
}
