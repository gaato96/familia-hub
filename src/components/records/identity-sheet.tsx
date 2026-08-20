"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { BloodType, MemberDetailRow } from "@/types/database";

const BLOOD_TYPES: BloodType[] = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

/**
 * Datos personales y legales.
 *
 * Usa `upsert` sobre member_id, que es la PK de la tabla: no hay un "crear" y
 * un "editar" separados porque no tiene sentido — o hay ficha o no la hay, y
 * la primera vez que alguien guarda es exactamente igual a la décima.
 */
export function IdentitySheet({
  open,
  memberId,
  details,
  onClose,
  onSaved,
}: {
  open: boolean;
  memberId: string;
  details: MemberDetailRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent
        title="Datos personales"
        description="Solo lo ven los adultos de la casa."
      >
        <IdentityForm memberId={memberId} details={details} onSaved={onSaved} />
      </SheetContent>
    </Sheet>
  );
}

function IdentityForm({
  memberId,
  details,
  onSaved,
}: {
  memberId: string;
  details: MemberDetailRow | null;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    full_legal_name: details?.full_legal_name ?? "",
    dni: details?.dni ?? "",
    cuil: details?.cuil ?? "",
    blood_type: details?.blood_type ?? "",
    health_insurance: details?.health_insurance ?? "",
    health_insurance_id: details?.health_insurance_id ?? "",
    allergies: details?.allergies ?? "",
    conditions: details?.conditions ?? "",
    emergency_notes: details?.emergency_notes ?? "",
    address: details?.address ?? "",
  });
  const [pending, setPending] = useState(false);

  const set =
    (key: keyof typeof form) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((current) => ({ ...current, [key]: event.target.value }));

  async function submit(event: React.FormEvent) {
    event.preventDefault();

    // El CHECK de la base pide 7 u 8 dígitos sin puntos. Se limpia acá para no
    // hacer fallar el guardado por escribir "12.345.678", que es como se tipea.
    const dni = form.dni.replace(/\D/g, "");
    if (dni && !/^\d{7,8}$/.test(dni)) {
      toast.error("El DNI tiene que tener 7 u 8 números.");
      return;
    }

    const cuil = form.cuil.replace(/[^\d-]/g, "");
    if (cuil && !/^\d{2}-?\d{7,8}-?\d$/.test(cuil)) {
      toast.error("El CUIL no parece válido. Ejemplo: 20-12345678-3");
      return;
    }

    setPending(true);

    const { error } = await createClient()
      .from("member_details")
      .upsert(
        {
          member_id: memberId,
          full_legal_name: form.full_legal_name.trim() || null,
          dni: dni || null,
          cuil: cuil || null,
          blood_type: (form.blood_type || null) as BloodType | null,
          health_insurance: form.health_insurance.trim() || null,
          health_insurance_id: form.health_insurance_id.trim() || null,
          allergies: form.allergies.trim() || null,
          conditions: form.conditions.trim() || null,
          emergency_notes: form.emergency_notes.trim() || null,
          address: form.address.trim() || null,
        },
        { onConflict: "member_id" },
      );

    setPending(false);

    if (error) {
      toast.error("No se pudo guardar.");
      return;
    }
    onSaved();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <Label htmlFor="fullName">Nombre completo</Label>
        <Input id="fullName" value={form.full_legal_name} onChange={set("full_legal_name")} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="dni">DNI</Label>
          <Input id="dni" inputMode="numeric" value={form.dni} onChange={set("dni")}
            placeholder="12345678" />
        </div>
        <div>
          <Label htmlFor="cuil">CUIL</Label>
          <Input id="cuil" inputMode="numeric" value={form.cuil} onChange={set("cuil")}
            placeholder="20-12345678-3" />
        </div>
      </div>

      <fieldset>
        <Label>Grupo sanguíneo</Label>
        <div className="flex flex-wrap gap-1.5">
          {BLOOD_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() =>
                setForm((c) => ({ ...c, blood_type: c.blood_type === type ? "" : type }))
              }
              aria-pressed={form.blood_type === type}
              className={cn(
                "min-w-12 rounded-full border px-3 py-1.5 text-sm font-semibold",
                form.blood_type === type
                  ? "border-primary bg-primary text-primary-fg"
                  : "border-border text-muted",
              )}
            >
              {type}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="insurance">Obra social</Label>
          <Input id="insurance" value={form.health_insurance}
            onChange={set("health_insurance")} />
        </div>
        <div>
          <Label htmlFor="insuranceId">N° de afiliado</Label>
          <Input id="insuranceId" value={form.health_insurance_id}
            onChange={set("health_insurance_id")} />
        </div>
      </div>

      {/* Estos tres son los que salen en la ficha de emergencia, que ve toda
          la casa. Se avisa para que nadie escriba acá algo privado creyendo
          que queda entre adultos. */}
      <div className="rounded-app border border-warning/40 bg-warning/5 p-3">
        <p className="mb-3 text-xs text-fg">
          Lo de abajo aparece en la ficha de emergencia, que ve cualquiera de la casa.
        </p>

        <div className="space-y-3">
          <div>
            <Label htmlFor="allergies">Alergias</Label>
            <Input id="allergies" value={form.allergies} onChange={set("allergies")}
              placeholder="Penicilina, maní" />
          </div>
          <div>
            <Label htmlFor="conditions">Condiciones</Label>
            <Input id="conditions" value={form.conditions} onChange={set("conditions")}
              placeholder="Asma" />
          </div>
          <div>
            <Label htmlFor="emergencyNotes">Nota de emergencia</Label>
            <Textarea id="emergencyNotes" rows={2} value={form.emergency_notes}
              onChange={set("emergency_notes")}
              placeholder="Lo que haría falta que sepa alguien en una guardia" />
          </div>
        </div>
      </div>

      <div>
        <Label htmlFor="address">Domicilio</Label>
        <Input id="address" value={form.address} onChange={set("address")} />
      </div>

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Guardando..." : "Guardar"}
      </Button>
    </form>
  );
}
