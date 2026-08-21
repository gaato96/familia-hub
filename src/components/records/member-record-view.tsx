"use client";

import {
  ArrowLeft,
  Pill,
  Plus,
  Ruler,
  Shirt,
  Stethoscope,
  Syringe,
  Trophy,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { MemberAvatar } from "@/components/app/member-chip";
import { DocumentList } from "@/components/records/document-list";
import { IdentitySheet } from "@/components/records/identity-sheet";
import { RecordEntrySheet, type EntryKind } from "@/components/records/record-entry-sheet";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/card";
import { formatLongDate, todayInAr } from "@/lib/dates";
import { ageLabel, formatHeight, formatWeight } from "@/lib/records/measures";
import { currentSizes, type MemberRecord } from "@/lib/records/queries";
import { cn } from "@/lib/utils";
import type { FamilyMemberRow } from "@/types/database";

type Tab = "salud" | "crecimiento" | "documentos" | "datos";

const TABS: { value: Tab; label: string }[] = [
  { value: "salud", label: "Salud" },
  { value: "crecimiento", label: "Crecimiento" },
  { value: "documentos", label: "Papeles" },
  { value: "datos", label: "Datos" },
];

export function MemberRecordView({
  member,
  record,
}: {
  member: FamilyMemberRow;
  record: MemberRecord;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("salud");
  const [entry, setEntry] = useState<EntryKind | null>(null);
  const [identityOpen, setIdentityOpen] = useState(false);

  const today = todayInAr();
  const refresh = () => router.refresh();

  const activeMeds = record.medications.filter((m) => m.is_active);
  const pastMeds = record.medications.filter((m) => !m.is_active);
  const pendingVaccines = record.vaccines.filter((v) => !v.applied_on);
  const appliedVaccines = record.vaccines.filter((v) => v.applied_on);
  const sizes = currentSizes(record.sizes);
  const lastGrowth = record.growth[0];

  return (
    <div className="space-y-4">
      <header className="flex items-center gap-3">
        <Link
          href="/familia"
          aria-label="Volver"
          className="grid size-10 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-2"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <MemberAvatar member={member} />
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold tracking-tight text-fg">
            {member.display_name}
          </h1>
          {member.birth_date ? (
            <p className="text-sm text-muted">{ageLabel(member.birth_date, today)}</p>
          ) : null}
        </div>
      </header>

      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
        {TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setTab(t.value)}
            aria-pressed={tab === t.value}
            className={cn(
              "shrink-0 rounded-full border px-3.5 py-2 text-sm font-medium",
              tab === t.value
                ? "border-primary bg-primary text-primary-fg"
                : "border-border bg-surface text-muted",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "salud" ? (
        <div className="space-y-5">
          <Section
            icon={<Pill className="size-4" />}
            title="Medicamentos"
            onAdd={() => setEntry("medication")}
          >
            {activeMeds.length === 0 && pastMeds.length === 0 ? (
              <EmptyState title="Sin medicamentos cargados" />
            ) : (
              <>
                <ul className="space-y-2">
                  {activeMeds.map((med) => (
                    <li key={med.id} className="rounded-app bg-surface shadow-card p-3">
                      <p className="font-medium text-fg">
                        {med.name}
                        {med.dose ? <span className="text-muted"> · {med.dose}</span> : null}
                      </p>
                      {med.frequency ? (
                        <p className="text-sm text-muted">{med.frequency}</p>
                      ) : null}
                      {/* "Para qué sirve" es el dato que convierte una lista de
                          cajas en algo útil a las 3 de la mañana. */}
                      {med.treats ? (
                        <p className="mt-1 text-sm text-fg">Para: {med.treats}</p>
                      ) : null}
                      {med.notes ? (
                        <p className="mt-1 text-sm text-muted">{med.notes}</p>
                      ) : null}
                    </li>
                  ))}
                </ul>

                {pastMeds.length > 0 ? (
                  <details className="mt-3">
                    <summary className="cursor-pointer text-sm text-muted">
                      Ya no toma ({pastMeds.length})
                    </summary>
                    <ul className="mt-2 space-y-1">
                      {pastMeds.map((med) => (
                        <li key={med.id} className="text-sm text-muted">
                          {med.name}
                          {med.ended_on ? ` · hasta ${med.ended_on}` : null}
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : null}
              </>
            )}
          </Section>

          <Section
            icon={<Syringe className="size-4" />}
            title="Vacunas"
            onAdd={() => setEntry("vaccine")}
          >
            {record.vaccines.length === 0 ? (
              <EmptyState title="Sin vacunas cargadas" />
            ) : (
              <>
                {pendingVaccines.length > 0 ? (
                  <ul className="mb-2 space-y-1.5">
                    {pendingVaccines.map((v) => (
                      <li
                        key={v.id}
                        className="flex items-center justify-between gap-2 rounded-app border border-warning/40 bg-warning/10 px-3 py-2"
                      >
                        <span className="min-w-0 truncate text-sm font-medium text-fg">
                          {v.name}
                          {v.dose_label ? (
                            <span className="text-muted"> · {v.dose_label}</span>
                          ) : null}
                        </span>
                        <span className="shrink-0 text-xs font-semibold text-warning">
                          {v.due_on ? `vence ${v.due_on}` : "pendiente"}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : null}

                <ul className="divide-y divide-border rounded-app bg-surface shadow-card">
                  {appliedVaccines.map((v) => (
                    <li key={v.id} className="flex items-center justify-between gap-2 p-3">
                      <span className="min-w-0 truncate text-sm text-fg">
                        {v.name}
                        {v.dose_label ? (
                          <span className="text-muted"> · {v.dose_label}</span>
                        ) : null}
                      </span>
                      <span className="shrink-0 text-xs text-muted">{v.applied_on}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Section>

          <Section
            icon={<Stethoscope className="size-4" />}
            title="Consultas"
            onAdd={() => setEntry("visit")}
          >
            {record.visits.length === 0 ? (
              <EmptyState title="Sin consultas cargadas" />
            ) : (
              <ul className="space-y-2">
                {record.visits.map((visit) => (
                  <li key={visit.id} className="rounded-app bg-surface shadow-card p-3">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="min-w-0 truncate font-medium text-fg">
                        {visit.specialty ?? "Consulta"}
                      </p>
                      <span className="shrink-0 text-xs text-muted">{visit.visited_on}</span>
                    </div>
                    {visit.professional ? (
                      <p className="text-sm text-muted">{visit.professional}</p>
                    ) : null}
                    {visit.diagnosis ? (
                      <p className="mt-1 text-sm text-fg">{visit.diagnosis}</p>
                    ) : null}
                    {visit.indications ? (
                      <p className="mt-1 whitespace-pre-wrap text-sm text-muted">
                        {visit.indications}
                      </p>
                    ) : null}
                    {visit.next_visit_on ? (
                      <p className="mt-2 text-xs font-semibold text-primary">
                        Próxima: {formatLongDate(visit.next_visit_on)}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      ) : null}

      {tab === "crecimiento" ? (
        <div className="space-y-5">
          <Section
            icon={<Ruler className="size-4" />}
            title="Peso y talla"
            onAdd={() => setEntry("growth")}
          >
            {record.growth.length === 0 ? (
              <EmptyState title="Sin mediciones" hint="Cargá el peso y la talla del último control." />
            ) : (
              <>
                {lastGrowth ? (
                  <div className="mb-2 grid grid-cols-2 gap-2">
                    <Stat label="Peso" value={formatWeight(lastGrowth.weight_grams)} />
                    <Stat label="Talla" value={formatHeight(lastGrowth.height_mm)} />
                  </div>
                ) : null}
                <ul className="divide-y divide-border rounded-app bg-surface shadow-card">
                  {record.growth.map((g) => (
                    <li key={g.id} className="flex items-center justify-between gap-2 p-3 text-sm">
                      <span className="text-muted">
                        {g.measured_on}
                        {member.birth_date ? (
                          <span> · {ageLabel(member.birth_date, g.measured_on)}</span>
                        ) : null}
                      </span>
                      <span className="shrink-0 text-fg">
                        {formatWeight(g.weight_grams)} · {formatHeight(g.height_mm)}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Section>

          <Section
            icon={<Shirt className="size-4" />}
            title="Talles actuales"
            onAdd={() => setEntry("size")}
          >
            {sizes.length === 0 ? (
              <EmptyState
                title="Sin talles cargados"
                hint="Sirve para no dudar parado en el local."
              />
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {sizes.map((size) => (
                  <Stat key={size.id} label={size.kind} value={size.value} />
                ))}
              </div>
            )}
          </Section>

          <Section
            icon={<Trophy className="size-4" />}
            title="Hitos"
            onAdd={() => setEntry("milestone")}
          >
            {record.milestones.length === 0 ? (
              <EmptyState title="Sin hitos cargados" />
            ) : (
              <ul className="space-y-2">
                {record.milestones.map((m) => (
                  <li key={m.id} className="rounded-app bg-surface shadow-card p-3">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="min-w-0 font-medium text-fg">{m.title}</p>
                      <span className="shrink-0 text-xs text-muted">{m.achieved_on}</span>
                    </div>
                    {m.notes ? <p className="mt-1 text-sm text-muted">{m.notes}</p> : null}
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      ) : null}

      {tab === "documentos" ? (
        <DocumentList
          documents={record.documents}
          memberId={member.id}
          familyId={member.family_id}
          onChanged={refresh}
        />
      ) : null}

      {tab === "datos" ? (
        <div className="space-y-3">
          <div className="divide-y divide-border overflow-hidden rounded-app bg-surface shadow-card">
            <Field label="Nombre completo" value={record.details?.full_legal_name} />
            <Field label="DNI" value={record.details?.dni} />
            <Field label="CUIL" value={record.details?.cuil} />
            <Field label="Grupo sanguíneo" value={record.details?.blood_type} />
            <Field label="Obra social" value={record.details?.health_insurance} />
            <Field label="N° de afiliado" value={record.details?.health_insurance_id} />
            <Field label="Alergias" value={record.details?.allergies} />
            <Field label="Condiciones" value={record.details?.conditions} />
            <Field label="Nota de emergencia" value={record.details?.emergency_notes} />
            <Field label="Domicilio" value={record.details?.address} />
          </div>

          <Button variant="outline" className="w-full" onClick={() => setIdentityOpen(true)}>
            Editar datos
          </Button>

          <p className="text-xs text-muted">
            El grupo sanguíneo, las alergias, las condiciones y la nota de emergencia son lo
            único de acá que aparece en la ficha de emergencia — que sí ve toda la casa.
          </p>
        </div>
      ) : null}

      <RecordEntrySheet
        kind={entry}
        memberId={member.id}
        onClose={() => setEntry(null)}
        onSaved={() => {
          setEntry(null);
          refresh();
        }}
      />

      <IdentitySheet
        open={identityOpen}
        memberId={member.id}
        details={record.details}
        onClose={() => setIdentityOpen(false)}
        onSaved={() => {
          setIdentityOpen(false);
          refresh();
        }}
      />
    </div>
  );
}

function Section({
  icon,
  title,
  onAdd,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  onAdd: () => void;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-muted">
          {icon}
          {title}
        </h2>
        <button
          type="button"
          onClick={onAdd}
          aria-label={`Agregar en ${title}`}
          className="grid size-8 place-items-center rounded-full text-primary hover:bg-surface-2"
        >
          <Plus className="size-4" />
        </button>
      </div>
      {children}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-app bg-surface shadow-card p-3">
      <p className="text-xs capitalize text-muted">{label}</p>
      <p className="text-lg font-bold text-fg">{value}</p>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-baseline justify-between gap-3 p-3">
      <span className="shrink-0 text-sm text-muted">{label}</span>
      <span className="min-w-0 text-right text-sm text-fg">{value || "—"}</span>
    </div>
  );
}
