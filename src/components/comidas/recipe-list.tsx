"use client";

import { Clock, Plus, Star, Trash2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { RecipeRow } from "@/types/database";

type DraftIngredient = { name: string; quantity: string; unit: string };

export function RecipeList({
  recipes,
  onChanged,
}: {
  recipes: RecipeRow[];
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);

  async function toggleFavorite(recipe: RecipeRow) {
    const { error } = await createClient()
      .from("recipes")
      .update({ is_favorite: !recipe.is_favorite })
      .eq("id", recipe.id);

    if (error) {
      toast.error("No se pudo guardar.");
      return;
    }
    onChanged();
  }

  async function remove(recipe: RecipeRow) {
    const { error } = await createClient().from("recipes").delete().eq("id", recipe.id);
    if (error) {
      toast.error("No se pudo borrar.");
      return;
    }
    onChanged();
  }

  return (
    <div className="space-y-3">
      <Button variant="outline" className="w-full" onClick={() => setOpen(true)}>
        <Plus /> Nueva receta
      </Button>

      {recipes.length === 0 ? (
        <EmptyState
          title="Sin recetas guardadas"
          hint="Cargá las que hacen siempre, con sus ingredientes: de ahí sale la lista del súper."
        />
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-app border border-border bg-surface">
          {recipes.map((recipe) => (
            <li key={recipe.id} className="flex items-center gap-2 p-3">
              <button
                type="button"
                onClick={() => toggleFavorite(recipe)}
                aria-label={
                  recipe.is_favorite ? "Sacar de favoritas" : "Marcar como favorita"
                }
                aria-pressed={recipe.is_favorite}
                className={cn(
                  "grid size-9 shrink-0 place-items-center rounded-full",
                  recipe.is_favorite ? "text-warning" : "text-muted/40",
                )}
              >
                <Star className={cn("size-4", recipe.is_favorite && "fill-current")} />
              </button>

              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-fg">
                  {recipe.title}
                </span>
                <span className="flex items-center gap-2 text-xs text-muted">
                  {recipe.minutes ? (
                    <span className="flex items-center gap-1">
                      <Clock className="size-3" />
                      {recipe.minutes} min
                    </span>
                  ) : null}
                  {recipe.servings ? <span>{recipe.servings} porciones</span> : null}
                </span>
              </span>

              <button
                type="button"
                onClick={() => remove(recipe)}
                aria-label={`Borrar ${recipe.title}`}
                className="grid size-9 shrink-0 place-items-center rounded-full text-muted/40 hover:text-danger"
              >
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent title="Nueva receta">
          <RecipeForm
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

function RecipeForm({ onDone }: { onDone: () => void }) {
  const [title, setTitle] = useState("");
  const [minutes, setMinutes] = useState("");
  const [servings, setServings] = useState("");
  const [instructions, setInstructions] = useState("");
  const [ingredients, setIngredients] = useState<DraftIngredient[]>([]);
  const [draft, setDraft] = useState<DraftIngredient>({ name: "", quantity: "", unit: "" });
  const [pending, setPending] = useState(false);

  function addIngredient() {
    if (!draft.name.trim()) return;
    setIngredients((current) => [...current, draft]);
    setDraft({ name: "", quantity: "", unit: "" });
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);

    const supabase = createClient();
    const { data, error } = await supabase
      .from("recipes")
      .insert({
        title: title.trim(),
        minutes: minutes ? Number(minutes) : null,
        servings: servings ? Number(servings) : null,
        instructions: instructions.trim() || null,
      })
      .select("id")
      .single();

    if (error || !data) {
      setPending(false);
      toast.error("No se pudo guardar la receta.");
      return;
    }

    const clean = ingredients.filter((i) => i.name.trim());
    if (clean.length > 0) {
      // Todas las filas con las mismas claves: PostgREST manda NULL explícito
      // donde falte una, en vez de usar el DEFAULT. Ver CLAUDE.md.
      const { error: ingredientsError } = await supabase.from("recipe_ingredients").insert(
        clean.map((ingredient, index) => ({
          recipe_id: data.id,
          name: ingredient.name.trim(),
          quantity: ingredient.quantity ? Number(ingredient.quantity.replace(",", ".")) : null,
          unit: ingredient.unit.trim() || null,
          position: index,
        })),
      );

      if (ingredientsError) {
        setPending(false);
        toast.error("La receta se guardó, pero los ingredientes no.");
        onDone();
        return;
      }
    }

    setPending(false);
    onDone();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <Label htmlFor="recipeTitle">Nombre</Label>
        <Input
          id="recipeTitle"
          required
          autoFocus
          maxLength={120}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Milanesas con puré"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="recipeMinutes">Minutos</Label>
          <Input
            id="recipeMinutes"
            type="number"
            min={1}
            max={600}
            inputMode="numeric"
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            placeholder="40"
          />
        </div>
        <div>
          <Label htmlFor="recipeServings">Porciones</Label>
          <Input
            id="recipeServings"
            type="number"
            min={1}
            max={50}
            inputMode="numeric"
            value={servings}
            onChange={(e) => setServings(e.target.value)}
            placeholder="4"
          />
        </div>
      </div>

      <fieldset>
        <Label>Ingredientes</Label>

        {ingredients.length > 0 ? (
          <ul className="mb-2 space-y-1">
            {ingredients.map((ingredient, index) => (
              <li
                key={`${ingredient.name}-${index}`}
                className="flex items-center gap-2 rounded-lg bg-surface-2 px-2.5 py-1.5 text-sm"
              >
                <span className="min-w-0 flex-1 truncate text-fg">
                  {ingredient.quantity ? `${ingredient.quantity} ` : ""}
                  {ingredient.unit ? `${ingredient.unit} ` : ""}
                  {ingredient.name}
                </span>
                <button
                  type="button"
                  onClick={() => setIngredients((c) => c.filter((_, i) => i !== index))}
                  aria-label={`Quitar ${ingredient.name}`}
                  className="grid size-7 shrink-0 place-items-center rounded-full text-muted hover:bg-border"
                >
                  <X className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="flex gap-1.5">
          <Input
            value={draft.quantity}
            onChange={(e) => setDraft({ ...draft, quantity: e.target.value })}
            placeholder="2"
            inputMode="decimal"
            aria-label="Cantidad"
            className="w-16 text-center"
          />
          <Input
            value={draft.unit}
            onChange={(e) => setDraft({ ...draft, unit: e.target.value })}
            placeholder="kg"
            aria-label="Unidad"
            className="w-20"
          />
          <Input
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            onKeyDown={(e) => {
              // Enter agrega el ingrediente, no envía la receta a medio armar.
              if (e.key === "Enter") {
                e.preventDefault();
                addIngredient();
              }
            }}
            placeholder="Papas"
            aria-label="Ingrediente"
            className="flex-1"
          />
          <Button
            type="button"
            variant="secondary"
            size="icon"
            onClick={addIngredient}
            aria-label="Agregar ingrediente"
          >
            <Plus />
          </Button>
        </div>

        <p className="mt-2 text-xs text-muted">
          Los ingredientes son lo que después se pasa solo a la lista del súper.
        </p>
      </fieldset>

      <div>
        <Label htmlFor="recipeInstructions">Cómo se hace</Label>
        <Textarea
          id="recipeInstructions"
          rows={4}
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
        />
      </div>

      <Button type="submit" size="lg" className="w-full" disabled={pending || !title.trim()}>
        {pending ? "Guardando..." : "Guardar receta"}
      </Button>
    </form>
  );
}
