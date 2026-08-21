"use client";

import { Clock, Star, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import type { IsoDate } from "@/lib/dates";
import type { PlannedMeal } from "@/lib/meals/queries";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { MealSlot, RecipeRow } from "@/types/database";

/**
 * Elegir qué se come en una franja.
 *
 * Dos caminos, y los dos importan: una receta guardada, o texto libre. La
 * mitad de las cenas de una casa son "sobras", "pizza" o "lo que haya" — si la
 * app obligara a cargar una receta para cada una, el menú quedaría a medio
 * llenar y dejaría de servir.
 */
export function MealSlotPicker({
  date,
  slot,
  recipes,
  current,
  onDone,
}: {
  date: IsoDate;
  slot: MealSlot;
  recipes: RecipeRow[];
  current: PlannedMeal | undefined;
  onDone: () => void;
}) {
  const [freeText, setFreeText] = useState(current?.free_text ?? "");
  const [pending, setPending] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = search.trim()
    ? recipes.filter((r) => r.title.toLowerCase().includes(search.trim().toLowerCase()))
    : recipes;

  /**
   * Upsert sobre (family_id, meal_date, slot): cambiar de idea sobre la cena
   * del jueves es reemplazar, no acumular. El unique de la base lo garantiza.
   */
  async function save(payload: { recipe_id: string | null; free_text: string | null }) {
    setPending(true);

    const { error } = await createClient()
      .from("meal_plan")
      .upsert(
        { meal_date: date, slot, ...payload },
        { onConflict: "family_id,meal_date,slot" },
      );

    setPending(false);

    if (error) {
      toast.error("No se pudo guardar.");
      return;
    }
    onDone();
  }

  async function clear() {
    if (!current) {
      onDone();
      return;
    }

    const { error } = await createClient().from("meal_plan").delete().eq("id", current.id);
    if (error) {
      toast.error("No se pudo borrar.");
      return;
    }
    onDone();
  }

  return (
    <div className="space-y-5">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!freeText.trim()) return;
          void save({ recipe_id: null, free_text: freeText.trim() });
        }}
      >
        <Label htmlFor="freeText">Escribir directo</Label>
        <div className="flex gap-2">
          <Input
            id="freeText"
            value={freeText}
            onChange={(e) => setFreeText(e.target.value)}
            placeholder="Sobras, pizza, milanesas"
            maxLength={120}
            className="flex-1"
          />
          <Button type="submit" disabled={pending || !freeText.trim()}>
            Listo
          </Button>
        </div>
      </form>

      {recipes.length > 0 ? (
        <section>
          <Label htmlFor="recipeSearch">O elegir una receta</Label>
          <Input
            id="recipeSearch"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar..."
            className="mb-2"
          />

          <ul className="max-h-64 space-y-1 overflow-y-auto">
            {filtered.map((recipe) => (
              <li key={recipe.id}>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => save({ recipe_id: recipe.id, free_text: null })}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg border p-2.5 text-left",
                    current?.recipe_id === recipe.id
                      ? "border-primary bg-primary/10"
                      : "border-border",
                  )}
                >
                  {recipe.is_favorite ? (
                    <Star className="size-4 shrink-0 fill-warning text-warning" />
                  ) : null}
                  <span className="min-w-0 flex-1 truncate text-sm text-fg">
                    {recipe.title}
                  </span>
                  {recipe.minutes ? (
                    <span className="flex shrink-0 items-center gap-1 text-xs text-muted">
                      <Clock className="size-3" />
                      {recipe.minutes}
                    </span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>

          {filtered.length === 0 ? (
            <p className="py-3 text-center text-sm text-muted">No hay recetas con ese nombre.</p>
          ) : null}
        </section>
      ) : (
        <p className="rounded-app border border-dashed border-border p-4 text-center text-sm text-muted">
          Todavía no hay recetas guardadas. Podés escribir directo arriba, o cargar recetas
          desde la pestaña Recetas para que la lista del súper se arme sola.
        </p>
      )}

      {current ? (
        <Button variant="outline" className="w-full" onClick={clear}>
          <Trash2 /> Sacar del menú
        </Button>
      ) : null}
    </div>
  );
}
