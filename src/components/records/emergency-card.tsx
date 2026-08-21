"use client";

import { Droplet, Phone, TriangleAlert, WifiOff } from "lucide-react";
import { useEffect, useSyncExternalStore } from "react";

import { MemberAvatar } from "@/components/app/member-chip";
import { todayInAr } from "@/lib/dates";
import {
  getCardServerSnapshot,
  getCardSnapshot,
  saveCard,
  subscribeCard,
  type CachedCard,
} from "@/lib/records/emergency-cache";
import { ageLabel } from "@/lib/records/measures";
import type { ContactRow, EmergencyCardRow } from "@/types/database";

/**
 * Ficha de emergencia.
 *
 * La única pantalla de la app pensada para leerse en voz alta, apurado, por
 * alguien que no es de la casa. De ahí las decisiones:
 *
 * - Los datos se guardan en localStorage y la pantalla arranca desde ahí. En
 *   una guardia puede no haber señal, y una ficha médica que necesita internet
 *   para abrirse es exactamente una ficha que no está cuando hace falta.
 * - Alergias y condiciones van ARRIBA de todo y en rojo. Es el dato que puede
 *   evitar que le den algo que le cae mal.
 * - Los teléfonos son `tel:` y no texto: se tocan y llaman.
 * - Tipografía grande. No se lee con calma.
 */

export function EmergencyCard({
  members,
  contacts,
  online,
}: {
  members: EmergencyCardRow[];
  contacts: ContactRow[];
  online: boolean;
}) {
  const hasFresh = online && members.length > 0;

  // La copia local. Se lee del store, no de un efecto con setState: así no hay
  // un primer render vacío que después parpadea al llenarse.
  const cached = useSyncExternalStore(
    subscribeCard,
    getCardSnapshot,
    getCardServerSnapshot,
  );

  // Guardar SÍ es sincronizar con un sistema externo, que es justamente para
  // lo que sirve un efecto.
  useEffect(() => {
    if (!hasFresh) return;
    saveCard({ savedAt: new Date().toISOString(), members, contacts });
  }, [hasFresh, members, contacts]);

  // Con datos del servidor se muestran esos; sin ellos, la última copia.
  const data: CachedCard | null = hasFresh
    ? { savedAt: new Date().toISOString(), members, contacts }
    : cached;

  if (!data) {
    return (
      <div className="rounded-app border border-dashed border-border-strong p-6 text-center">
        <p className="text-sm text-muted">
          Todavía no hay ficha guardada. Abrí esta pantalla una vez con internet
          para que quede disponible sin conexión.
        </p>
      </div>
    );
  }

  const isStale = !online;
  const emergencyContacts = data.contacts.filter((c) => c.is_emergency);
  const today = todayInAr();

  return (
    <div className="space-y-4">
      {isStale ? (
        <p className="flex items-center gap-2 rounded-app bg-warning/10 px-3 py-2 text-xs text-fg">
          <WifiOff className="size-4 shrink-0 text-warning" />
          Sin conexión. Datos guardados el{" "}
          {new Date(data.savedAt).toLocaleDateString("es-AR")}.
        </p>
      ) : null}

      {data.members.map((member) => {
        const hasAlerts = Boolean(member.allergies || member.conditions);

        return (
          <section
            key={member.member_id}
            className="overflow-hidden rounded-app bg-surface shadow-card"
          >
            <header className="flex items-center gap-3 border-b border-border p-4">
              <MemberAvatar member={{ display_name: member.display_name, color: member.color }} />
              <div className="min-w-0">
                <h2 className="truncate text-lg font-bold text-fg">{member.display_name}</h2>
                {member.birth_date ? (
                  <p className="text-sm text-muted">{ageLabel(member.birth_date, today)}</p>
                ) : null}
              </div>
              {member.blood_type ? (
                <span className="ml-auto flex shrink-0 items-center gap-1 rounded-full bg-danger/10 px-3 py-1.5 text-base font-bold text-danger">
                  <Droplet className="size-4 fill-current" />
                  {member.blood_type}
                </span>
              ) : null}
            </header>

            {hasAlerts ? (
              <div className="border-b border-border bg-danger/5 p-4">
                {member.allergies ? (
                  <p className="flex gap-2 text-base font-semibold text-danger">
                    <TriangleAlert className="mt-0.5 size-5 shrink-0" />
                    <span>
                      Alergias: <span className="font-bold">{member.allergies}</span>
                    </span>
                  </p>
                ) : null}
                {member.conditions ? (
                  <p className="mt-2 text-base text-fg">{member.conditions}</p>
                ) : null}
              </div>
            ) : null}

            <div className="space-y-3 p-4">
              {member.medications.length > 0 ? (
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
                    Toma actualmente
                  </h3>
                  <ul className="mt-1 space-y-0.5">
                    {member.medications.map((med) => (
                      <li key={med} className="text-base text-fg">
                        {med}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {member.emergency_notes ? (
                <p className="whitespace-pre-wrap text-base text-fg">
                  {member.emergency_notes}
                </p>
              ) : null}

              {!hasAlerts && member.medications.length === 0 && !member.emergency_notes ? (
                <p className="text-sm text-muted">Sin datos médicos cargados.</p>
              ) : null}
            </div>
          </section>
        );
      })}

      {emergencyContacts.length > 0 ? (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-muted">Teléfonos de urgencia</h2>
          <ul className="divide-y divide-border overflow-hidden rounded-app bg-surface shadow-card">
            {emergencyContacts.map((contact) => (
              <li key={contact.id}>
                <a
                  href={contact.phone ? `tel:${contact.phone.replace(/\s/g, "")}` : undefined}
                  className="flex items-center gap-3 p-4"
                >
                  <span className="grid size-11 shrink-0 place-items-center rounded-full bg-success/10 text-success">
                    <Phone className="size-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-base font-semibold text-fg">
                      {contact.name}
                    </span>
                    {contact.role ? (
                      <span className="block truncate text-sm text-muted">{contact.role}</span>
                    ) : null}
                  </span>
                  {contact.phone ? (
                    <span className="shrink-0 text-base font-medium text-primary">
                      {contact.phone}
                    </span>
                  ) : null}
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
