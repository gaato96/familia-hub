"use client";

import { Minus, Plus, ShoppingCart, Trash2, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { relativeDayLabel, type IsoDate } from "@/lib/dates";
import {
  formatQuantity,
  locationLabel,
  PANTRY_LOCATIONS,
  pantryAlert,
  summarizePantry,
} from "@/lib/meals/pantry";
import type { ShoppingList } from "@/lib/shopping/queries";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { PantryItemRow, PantryLocation } from "@/types/database";

export function PantryPanel({
  items,
  today,
  lists,
  onChanged,
}: {
  items: PantryItemRow[];
  today: IsoDate;
  lists: ShoppingList[];
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const summary = summarizePantry(items, today);

  /**
   * Cambiar el stock de a uno. Es la interacción que más se usa —se acabó la
   * leche, quedan dos yogures— y por eso son botones grandes y no un campo de
   * texto: se toca con una mano parado frente a la heladera.
   */
  async function adjust(item: PantryItemRow, delta: number) {
    const next = Math.max(0, Number((item.quantity + delta).toFixed(2)));

    const { error } = await createClient()
      .from("pantry_items")
      .update({ quantity: next })
      .eq("id", item.id);

    if (error) {
      toast.error("No se pudo actualizar.");
      return;
    }
    onChanged();
  }

  async function remove(item: PantryItemRow) {
    const { error } = await createClient().from("pantry_items").delete().eq("id", item.id);
    if (error) {
      toast.error("No se pudo borrar.");
      return;
    }
    onChanged();
  }

  /** Pasa a la lista del súper todo lo que está por debajo del mínimo. */
  async function restockToList() {
    const target = lists.find((l) => l.kind === "supermercado") ?? lists[0];
    if (!target) {
      toast.error("No hay ninguna lista de compras donde volcar.");
      return;
    }
    if (summary.toRestock.length === 0) return;

    const { error } = await createClient()
      .from("shopping_items")
      // Mismas claves en todas las filas — ver CLAUDE.md sobre los inserts
      // múltiples y el DEFAULT que PostgREST no aplica.
      .insert(
        summary.toRestock.map((item) => ({
          list_id: target.id,
          name: item.name,
          unit: item.unit,
        })),
      );

    if (error) {
      toast.error("No se pudo pasar a la lista.");
      return;
    }
    toast.success(`${summary.toRestock.length} cosas agregadas a ${target.name}.`);
  }

  const byLocation = PANTRY_LOCATIONS.map((location) => ({
    location,
    items: items.filter((i) => i.location === location.value),
  })).filter((group) => group.items.length > 0);

  return (
    <div className="space-y-3">
      <Button variant="outline" className="w-full" onClick={() => setOpen(true)}>
        <Plus /> Agregar a la despensa
      </Button>

      {summary.expired.length > 0 ? (
        <section className="rounded-app border border-danger/40 bg-danger/5 p-3">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-danger">
            <TriangleAlert className="size-4" />
            Vencido
          </h2>
          <ul className="mt-1 space-y-0.5 text-sm text-fg">
            {summary.expired.map((item) => (
              <li key={item.id}>
                {item.name} · venció {relativeDayLabel(item.expires_on!, today)}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {summary.expiringSoon.length > 0 ? (
        <section className="rounded-app border border-warning/40 bg-warning/10 p-3">
          <h2 className="text-sm font-semibold text-warning">Se vence pronto</h2>
          <ul className="mt-1 space-y-0.5 text-sm text-fg">
            {summary.expiringSoon.map((item) => (
              <li key={item.id}>
                {item.name} · {relativeDayLabel(item.expires_on!, today)}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {summary.toRestock.length > 0 ? (
        <section className="rounded-app bg-surface shadow-card p-3">
          <h2 className="text-sm font-semibold text-fg">Hay que reponer</h2>
          <ul className="mt-1 space-y-0.5 text-sm text-muted">
            {summary.toRestock.map((item) => (
              <li key={item.id}>{item.name}</li>
            ))}
          </ul>
          <Button variant="secondary" size="sm" className="mt-2 w-full" onClick={restockToList}>
            <ShoppingCart /> Pasar a la lista del súper
          </Button>
        </section>
      ) : null}

      {items.length === 0 ? (
        <EmptyState
          title="La despensa está vacía"
          hint="Cargá lo que conviene no quedarse sin: leche, café, pañales."
        />
      ) : (
        byLocation.map((group) => (
          <section key={group.location.value}>
            <h2 className="mb-1.5 text-sm font-semibold text-muted">
              {group.location.label}
            </h2>
            <ul className="divide-y divide-border overflow-hidden rounded-app bg-surface shadow-card">
              {group.items.map((item) => {
                const alert = pantryAlert(item, today);

                return (
                  <li key={item.id} className="flex items-center gap-1 p-2 pl-3">
                    <span className="min-w-0 flex-1">
                      <span
                        className={cn(
                          "block truncate text-sm",
                          alert === "vencido" ? "text-danger" : "text-fg",
                        )}
                      >
                        {item.name}
                      </span>
                      <span className="block text-xs text-muted">
                        {formatQuantity(item.quantity, item.unit)}
                        {item.min_quantity !== null ? ` · mín ${item.min_quantity}` : ""}
                        {item.expires_on ? ` · vence ${item.expires_on}` : ""}
                      </span>
                    </span>

                    <button
                      type="button"
                      onClick={() => adjust(item, -1)}
                      aria-label={`Restar uno de ${item.name}`}
                      disabled={item.quantity <= 0}
                      className="grid size-10 shrink-0 place-items-center rounded-full text-muted disabled:opacity-30"
                    >
                      <Minus className="size-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => adjust(item, 1)}
                      aria-label={`Sumar uno a ${item.name}`}
                      className="grid size-10 shrink-0 place-items-center rounded-full text-muted"
                    >
                      <Plus className="size-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(item)}
                      aria-label={`Borrar ${item.name}`}
                      className="grid size-9 shrink-0 place-items-center rounded-full text-muted/40 hover:text-danger"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent title="Agregar a la despensa">
          <PantryForm
            onDone={() => {
              setOpen(false);
              onChanged();
            }}
          />
        </SheetContent>
      </Sheet>
    </div>
  );
}

function PantryForm({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unit, setUnit] = useState("");
  const [location, setLocation] = useState<PantryLocation>("despensa");
  const [minQuantity, setMinQuantity] = useState("");
  const [expiresOn, setExpiresOn] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);

    const { error } = await createClient().from("pantry_items").insert({
      name: name.trim(),
      quantity: Number(quantity.replace(",", ".")) || 0,
      unit: unit.trim() || null,
      location,
      min_quantity: minQuantity ? Number(minQuantity.replace(",", ".")) : null,
      expires_on: expiresOn || null,
    });

    setPending(false);

    if (error) {
      // El unique es (family_id, name, location): el mismo producto dos veces
      // en el mismo lugar rompería el descuento automático de la lista.
      toast.error(
        error.message.includes("duplicate") || error.message.includes("unique")
          ? `Ya tenés "${name.trim()}" en ${locationLabel(location).toLowerCase()}.`
          : "No se pudo guardar.",
      );
      return;
    }
    onDone();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <Label htmlFor="pantryName">Qué es</Label>
        <Input
          id="pantryName"
          required
          autoFocus
          maxLength={120}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Leche"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="pantryQuantity">Cuánto hay</Label>
          <Input
            id="pantryQuantity"
            inputMode="decimal"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="pantryUnit">Unidad</Label>
          <Input
            id="pantryUnit"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            placeholder="litros, kg, paquetes"
          />
        </div>
      </div>

      <fieldset>
        <Label>Dónde está</Label>
        <div className="flex flex-wrap gap-1.5">
          {PANTRY_LOCATIONS.map((l) => (
            <button
              key={l.value}
              type="button"
              onClick={() => setLocation(l.value)}
              aria-pressed={location === l.value}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium",
                location === l.value
                  ? "border-primary bg-primary text-primary-fg"
                  : "border-border text-muted",
              )}
            >
              {l.label}
            </button>
          ))}
        </div>
      </fieldset>

      <div>
        <Label htmlFor="pantryMin">Avisar cuando quede menos de</Label>
        <Input
          id="pantryMin"
          inputMode="decimal"
          value={minQuantity}
          onChange={(e) => setMinQuantity(e.target.value)}
          placeholder="1"
        />
        <p className="mt-1 text-xs text-muted">
          Por debajo de este número aparece en &ldquo;hay que reponer&rdquo;.
        </p>
      </div>

      <div>
        <Label htmlFor="pantryExpires">Vence el (opcional)</Label>
        <Input
          id="pantryExpires"
          type="date"
          value={expiresOn}
          onChange={(e) => setExpiresOn(e.target.value)}
        />
      </div>

      <Button type="submit" size="lg" className="w-full" disabled={pending || !name.trim()}>
        {pending ? "Guardando..." : "Guardar"}
      </Button>
    </form>
  );
}
