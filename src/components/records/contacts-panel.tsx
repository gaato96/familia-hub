"use client";

import { Phone, Plus, Star, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { CONTACT_CATEGORIES } from "@/lib/records/queries";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { ContactCategory, ContactRow } from "@/types/database";

export function ContactsPanel({
  contacts,
  isParent,
}: {
  contacts: ContactRow[];
  isParent: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  // Los de urgencia primero, siempre. Es el orden en el que se buscan cuando
  // hace falta buscarlos.
  const sorted = [...contacts].sort((a, b) => {
    if (a.is_emergency !== b.is_emergency) return a.is_emergency ? -1 : 1;
    return a.position - b.position;
  });

  async function toggleEmergency(contact: ContactRow) {
    const { error } = await createClient()
      .from("contacts")
      .update({ is_emergency: !contact.is_emergency })
      .eq("id", contact.id);

    if (error) {
      toast.error("No se pudo cambiar.");
      return;
    }
    router.refresh();
  }

  async function remove(contact: ContactRow) {
    const { error } = await createClient().from("contacts").delete().eq("id", contact.id);
    if (error) {
      toast.error("No se pudo borrar.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {isParent ? (
        <Button variant="outline" className="w-full" onClick={() => setOpen(true)}>
          <Plus /> Agregar contacto
        </Button>
      ) : null}

      {sorted.length === 0 ? (
        <EmptyState
          icon={<Phone className="size-8" />}
          title="Sin contactos cargados"
          hint="El pediatra, la guardia, el plomero: los que hacen falta a mano."
        />
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-app bg-surface shadow-card">
          {sorted.map((contact) => (
            <li key={contact.id} className="flex items-center gap-2 pr-2">
              <a
                href={contact.phone ? `tel:${contact.phone.replace(/\s/g, "")}` : undefined}
                className="flex min-w-0 flex-1 items-center gap-3 p-3"
              >
                <span
                  className={cn(
                    "grid size-10 shrink-0 place-items-center rounded-full",
                    contact.is_emergency
                      ? "bg-danger/10 text-danger"
                      : "bg-surface-2 text-muted",
                  )}
                >
                  <Phone className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-fg">
                    {contact.name}
                  </span>
                  <span className="block truncate text-xs text-muted">
                    {contact.role ?? labelFor(contact.category)}
                    {contact.phone ? ` · ${contact.phone}` : ""}
                  </span>
                </span>
              </a>

              {isParent ? (
                <>
                  <button
                    type="button"
                    onClick={() => toggleEmergency(contact)}
                    aria-label={
                      contact.is_emergency
                        ? "Sacar de la ficha de emergencia"
                        : "Poner en la ficha de emergencia"
                    }
                    aria-pressed={contact.is_emergency}
                    title="Los marcados aparecen en la ficha de emergencia"
                    className={cn(
                      "grid size-9 shrink-0 place-items-center rounded-full",
                      contact.is_emergency ? "text-warning" : "text-muted/40",
                    )}
                  >
                    <Star className={cn("size-4", contact.is_emergency && "fill-current")} />
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(contact)}
                    aria-label={`Borrar ${contact.name}`}
                    className="grid size-9 shrink-0 place-items-center rounded-full text-muted/40 hover:text-danger"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent title="Nuevo contacto">
          <ContactForm
            nextPosition={contacts.length}
            onDone={() => {
              setOpen(false);
              router.refresh();
            }}
          />
        </SheetContent>
      </Sheet>
    </div>
  );
}

function ContactForm({
  nextPosition,
  onDone,
}: {
  nextPosition: number;
  onDone: () => void;
}) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [phone, setPhone] = useState("");
  const [category, setCategory] = useState<ContactCategory>("salud");
  const [isEmergency, setIsEmergency] = useState(false);
  const [notes, setNotes] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);

    const { error } = await createClient().from("contacts").insert({
      name: name.trim(),
      role: role.trim() || null,
      phone: phone.trim() || null,
      category,
      is_emergency: isEmergency,
      notes: notes.trim() || null,
      position: nextPosition,
    });

    setPending(false);

    if (error) {
      toast.error("No se pudo guardar.");
      return;
    }
    onDone();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <Label htmlFor="contactName">Nombre</Label>
        <Input id="contactName" required autoFocus maxLength={120} value={name}
          onChange={(e) => setName(e.target.value)} placeholder="Dra. Pérez" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="contactRole">Qué es</Label>
          <Input id="contactRole" value={role} onChange={(e) => setRole(e.target.value)}
            placeholder="Pediatra" />
        </div>
        <div>
          <Label htmlFor="contactPhone">Teléfono</Label>
          <Input id="contactPhone" type="tel" inputMode="tel" value={phone}
            onChange={(e) => setPhone(e.target.value)} placeholder="11 5555 5555" />
        </div>
      </div>

      <fieldset>
        <Label>Categoría</Label>
        <div className="flex flex-wrap gap-1.5">
          {CONTACT_CATEGORIES.map((c) => (
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
      </fieldset>

      <label className="flex items-center gap-2.5 text-sm text-fg">
        <input
          type="checkbox"
          checked={isEmergency}
          onChange={(e) => setIsEmergency(e.target.checked)}
          className="size-5 accent-[var(--app-primary)]"
        />
        Mostrar en la ficha de emergencia
      </label>

      <div>
        <Label htmlFor="contactNotes">Notas</Label>
        <Textarea id="contactNotes" rows={2} value={notes}
          onChange={(e) => setNotes(e.target.value)} />
      </div>

      <Button type="submit" size="lg" className="w-full" disabled={pending || !name.trim()}>
        {pending ? "Guardando..." : "Guardar"}
      </Button>
    </form>
  );
}

function labelFor(category: ContactCategory): string {
  return CONTACT_CATEGORIES.find((c) => c.value === category)?.label ?? category;
}
