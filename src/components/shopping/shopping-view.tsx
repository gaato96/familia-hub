"use client";

import { Check, Eraser, Plus, Repeat2, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useShoppingRealtime } from "@/hooks/use-shopping-realtime";
import { formatMoney } from "@/lib/money";
import { LIST_STYLE, type ShoppingItem, type ShoppingList } from "@/lib/shopping/queries";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { FamilyMemberRow } from "@/types/database";

export function ShoppingView({
  lists,
  initialItems,
  members,
}: {
  lists: ShoppingList[];
  initialItems: ShoppingItem[];
  members: FamilyMemberRow[];
}) {
  const { items, setItems, refetch } = useShoppingRealtime(initialItems);
  const [activeListId, setActiveListId] = useState(lists[0]?.id ?? "");
  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState(false);

  const byId = new Map(members.map((m) => [m.id, m]));
  const activeList = lists.find((l) => l.id === activeListId);
  const listItems = items.filter((i) => i.list_id === activeListId);
  const pending = listItems.filter((i) => !i.is_checked);
  const bought = listItems.filter((i) => i.is_checked);

  const estimate = pending.reduce((sum, i) => sum + (i.est_price_cents ?? 0), 0);

  async function addItem(event: React.FormEvent) {
    event.preventDefault();
    const name = draft.trim();
    if (!name || !activeListId) return;

    setDraft("");
    setAdding(true);

    const { error } = await createClient()
      .from("shopping_items")
      .insert({ list_id: activeListId, name });

    setAdding(false);

    if (error) {
      toast.error("No se pudo agregar.");
      setDraft(name);
      return;
    }
    void refetch();
  }

  async function toggleItem(item: ShoppingItem) {
    const next = !item.is_checked;
    // Optimista: se tildan diez cosas seguidas caminando por el súper.
    setItems((current) =>
      current.map((i) => (i.id === item.id ? { ...i, is_checked: next } : i)),
    );

    const { error } = await createClient()
      .from("shopping_items")
      .update({ is_checked: next })
      .eq("id", item.id);

    if (error) {
      toast.error("No se pudo actualizar.");
      void refetch();
    }
  }

  async function removeItem(item: ShoppingItem) {
    setItems((current) => current.filter((i) => i.id !== item.id));
    const { error } = await createClient().from("shopping_items").delete().eq("id", item.id);
    if (error) {
      toast.error("No se pudo borrar.");
      void refetch();
    }
  }

  async function toggleFrequent(item: ShoppingItem) {
    const next = !item.is_frequent;
    setItems((current) =>
      current.map((i) => (i.id === item.id ? { ...i, is_frequent: next } : i)),
    );
    await createClient()
      .from("shopping_items")
      .update({ is_frequent: next })
      .eq("id", item.id);
  }

  async function clearBought() {
    if (!activeListId) return;

    const { error } = await createClient().rpc("clear_checked_items", {
      p_list_id: activeListId,
    });

    if (error) {
      toast.error("No se pudo vaciar la lista.");
      return;
    }
    toast.success("Listo. Los frecuentes quedaron para la próxima.");
    void refetch();
  }

  // `lg:max-w-3xl` y no todo el ancho del contenedor: una lista de compras de
  // 1100px es ilegible, el ojo pierde el renglón entre el tilde de la
  // izquierda y el precio de la derecha.
  return (
    <div className="space-y-4 lg:max-w-3xl">
      <h1 className="text-2xl font-bold tracking-tight text-fg lg:text-3xl">Compras</h1>

      {/* Pestañas deslizables: seis listas no entran en una fila de teléfono. */}
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
        {lists.map((list) => {
          const style = LIST_STYLE[list.kind];
          const count = items.filter((i) => i.list_id === list.id && !i.is_checked).length;
          const active = list.id === activeListId;

          return (
            <button
              key={list.id}
              type="button"
              onClick={() => setActiveListId(list.id)}
              aria-pressed={active}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-2 text-sm font-medium",
                active
                  ? "border-transparent text-white"
                  : "border-border bg-surface text-muted",
              )}
              style={active ? { backgroundColor: style.accent } : undefined}
            >
              <span aria-hidden>{style.emoji}</span>
              {list.name}
              {count > 0 ? (
                <span
                  className={cn(
                    "rounded-full px-1.5 text-xs font-bold",
                    active ? "bg-white/25" : "bg-surface-2",
                  )}
                >
                  {count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {/* El campo de agregar va ARRIBA de la lista: es lo que más se usa, y
          abajo quedaría tapado por el teclado al abrirse. */}
      <form onSubmit={addItem} className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={`Agregar a ${activeList?.name ?? "la lista"}`}
          enterKeyHint="done"
          className="flex-1"
        />
        <Button type="submit" size="icon" disabled={adding || !draft.trim()} aria-label="Agregar">
          <Plus />
        </Button>
      </form>

      {listItems.length === 0 ? (
        <EmptyState
          title="No falta nada acá"
          hint="Escribí arriba lo que haya que comprar y lo ven todos."
        />
      ) : (
        <>
          <ul className="divide-y divide-border rounded-app bg-surface shadow-card">
            {pending.map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                checkedByName={undefined}
                onToggle={toggleItem}
                onRemove={removeItem}
                onToggleFrequent={toggleFrequent}
              />
            ))}
          </ul>

          {estimate > 0 ? (
            <p className="text-right text-xs text-muted">
              Estimado de lo que falta: {formatMoney(estimate)}
            </p>
          ) : null}

          {bought.length > 0 ? (
            <section>
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-muted">
                  Ya está ({bought.length})
                </h2>
                <button
                  type="button"
                  onClick={clearBought}
                  className="flex items-center gap-1 text-xs font-semibold text-primary"
                >
                  <Eraser className="size-3.5" />
                  Vaciar
                </button>
              </div>
              <ul className="divide-y divide-border rounded-app bg-surface shadow-card opacity-60">
                {bought.map((item) => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    checkedByName={
                      item.checked_by_member_id
                        ? byId.get(item.checked_by_member_id)?.display_name
                        : undefined
                    }
                    onToggle={toggleItem}
                    onRemove={removeItem}
                    onToggleFrequent={toggleFrequent}
                  />
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}

function ItemRow({
  item,
  checkedByName,
  onToggle,
  onRemove,
  onToggleFrequent,
}: {
  item: ShoppingItem;
  checkedByName: string | undefined;
  onToggle: (item: ShoppingItem) => void;
  onRemove: (item: ShoppingItem) => void;
  onToggleFrequent: (item: ShoppingItem) => void;
}) {
  return (
    <li className="flex items-center gap-1 pr-2">
      <button
        type="button"
        onClick={() => onToggle(item)}
        role="checkbox"
        aria-checked={item.is_checked}
        className="flex min-w-0 flex-1 items-center gap-3 py-1 pl-2 text-left"
      >
        <span
          className={cn(
            // Redondo y no cuadrado: un círculo vacío se lee como "esto
            // espera a alguien"; un cuadrado vacío, como un campo de formulario.
            "grid size-6 shrink-0 place-items-center rounded-full border-2 transition-colors",
            item.is_checked ? "border-success bg-success text-white" : "border-border-strong",
          )}
        >
          {item.is_checked ? <Check className="size-4 stroke-[3]" /> : null}
        </span>

        <span className="min-w-0 flex-1 py-2.5">
          <span
            className={cn(
              "block truncate text-sm",
              item.is_checked ? "text-muted line-through" : "text-fg",
            )}
          >
            {item.name}
            {item.quantity ? (
              <span className="text-muted">
                {" "}
                · {item.quantity}
                {item.unit ? ` ${item.unit}` : ""}
              </span>
            ) : null}
          </span>
          {checkedByName ? (
            <span className="block truncate text-xs text-muted">Lo compró {checkedByName}</span>
          ) : null}
        </span>
      </button>

      <button
        type="button"
        onClick={() => onToggleFrequent(item)}
        aria-label={item.is_frequent ? "Sacar de frecuentes" : "Marcar como frecuente"}
        aria-pressed={item.is_frequent}
        title="Los frecuentes vuelven destildados al vaciar la lista"
        className={cn(
          "grid size-9 shrink-0 place-items-center rounded-full",
          item.is_frequent ? "text-primary" : "text-muted/40",
        )}
      >
        <Repeat2 className="size-4" />
      </button>

      <button
        type="button"
        onClick={() => onRemove(item)}
        aria-label={`Borrar ${item.name}`}
        className="grid size-9 shrink-0 place-items-center rounded-full text-muted/40 hover:text-danger"
      >
        <Trash2 className="size-4" />
      </button>
    </li>
  );
}
