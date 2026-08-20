"use client";

import { useState } from "react";
import { toast } from "sonner";

import { MemberAvatar } from "@/components/app/member-chip";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import type { IsoDate } from "@/lib/dates";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { EventCategory, FamilyMemberRow } from "@/types/database";

const CATEGORIES: { value: EventCategory; label: string }[] = [
  { value: "familia", label: "Familia" },
  { value: "salud", label: "Salud" },
  { value: "escuela", label: "Escuela" },
  { value: "trabajo", label: "Trabajo" },
  { value: "social", label: "Social" },
  { value: "tramites", label: "Trámites" },
];

export function EventForm({
  members,
  defaultDate,
  onDone,
}: {
  members: FamilyMemberRow[];
  defaultDate: IsoDate;
  onDone: () => void;
}) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState<IsoDate>(defaultDate);
  const [time, setTime] = useState("18:00");
  const [allDay, setAllDay] = useState(false);
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<EventCategory>("familia");
  const [attendees, setAttendees] = useState<string[]>([]);
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);

    const supabase = createClient();

    // El offset -03 va explícito: sin él, `new Date("2026-09-05T18:00")` se
    // interpreta con el huso de quien lo escribe. Un evento cargado desde una
    // laptop en otro país quedaría corrido varias horas para toda la familia.
    const startsAt = allDay
      ? `${date}T00:00:00-03:00`
      : `${date}T${time}:00-03:00`;

    const { data, error } = await supabase
      .from("events")
      .insert({
        title: title.trim(),
        description: description.trim() || null,
        location: location.trim() || null,
        starts_at: new Date(startsAt).toISOString(),
        is_all_day: allDay,
        category,
      })
      .select("id")
      .single();

    if (error || !data) {
      setPending(false);
      toast.error("No se pudo crear el evento.");
      return;
    }

    // Sin asistentes = es de toda la casa. Solo se escriben filas cuando
    // alguien eligió a quiénes involucra.
    if (attendees.length > 0) {
      await supabase
        .from("event_attendees")
        .insert(attendees.map((memberId) => ({ event_id: data.id, member_id: memberId })));
    }

    setPending(false);
    onDone();
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div>
        <Label htmlFor="eventTitle">¿Qué pasa?</Label>
        <Input
          id="eventTitle"
          required
          autoFocus
          maxLength={120}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Pediatra de Julián"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="eventDate">Día</Label>
          <Input
            id="eventDate"
            type="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value as IsoDate)}
          />
        </div>
        <div>
          <Label htmlFor="eventTime">Hora</Label>
          <Input
            id="eventTime"
            type="time"
            value={time}
            disabled={allDay}
            onChange={(e) => setTime(e.target.value)}
          />
        </div>
      </div>

      <label className="flex items-center gap-2.5 text-sm text-fg">
        <input
          type="checkbox"
          checked={allDay}
          onChange={(e) => setAllDay(e.target.checked)}
          className="size-5 accent-[var(--app-primary)]"
        />
        Dura todo el día
      </label>

      <div>
        <Label htmlFor="location">Dónde</Label>
        <Input
          id="location"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Consultorio, dirección, lo que sea"
        />
      </div>

      <div>
        <Label>Tipo</Label>
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => setCategory(c.value)}
              aria-pressed={category === c.value}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium",
                category === c.value
                  ? "border-primary bg-primary text-primary-fg"
                  : "border-border text-muted",
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <fieldset>
        <Label>¿Quiénes van?</Label>
        <div className="flex flex-wrap gap-1.5">
          {members.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() =>
                setAttendees((current) =>
                  current.includes(m.id)
                    ? current.filter((id) => id !== m.id)
                    : [...current, m.id],
                )
              }
              aria-pressed={attendees.includes(m.id)}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs font-medium",
                attendees.includes(m.id)
                  ? "border-primary bg-primary/10 text-fg"
                  : "border-border text-muted",
              )}
            >
              <MemberAvatar member={m} size="sm" />
              {m.display_name}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted">
          Si no elegís a nadie, queda como evento de toda la casa.
        </p>
      </fieldset>

      <div>
        <Label htmlFor="eventDescription">Detalle</Label>
        <Textarea
          id="eventDescription"
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <Button type="submit" size="lg" className="w-full" disabled={pending || !title.trim()}>
        {pending ? "Guardando..." : "Crear evento"}
      </Button>
    </form>
  );
}
