"use client";

import { ChevronLeft, ChevronRight, Clock, ShoppingCart } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { MealSlotPicker } from "@/components/comidas/meal-slot-picker";
import { PantryPanel } from "@/components/comidas/pantry-panel";
import { RecipeList } from "@/components/comidas/recipe-list";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { addDaysIso, formatDayLabel, weekDaysAr, type IsoDate } from "@/lib/dates";
import { MEAL_SLOTS, mealLabel, type WeekMeals } from "@/lib/meals/queries";
import { createClient } from "@/lib/supabase/client";
import type { ShoppingList } from "@/lib/shopping/queries";
import { cn } from "@/lib/utils";
import type { MealSlot } from "@/types/database";

type Tab = "menu" | "recetas" | "despensa";

export function MealsView({
  monday,
  today,
  week,
  lists,
}: {
  monday: IsoDate;
  today: IsoDate;
  week: WeekMeals;
  lists: ShoppingList[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("menu");
  const [editing, setEditing] = useState<{ date: IsoDate; slot: MealSlot } | null>(null);
  const [generating, setGenerating] = useState(false);

  const days = weekDaysAr(monday);
  const sunday = addDaysIso(monday, 6);
  const refresh = () => router.refresh();

  const plannedCount = week.meals.filter((m) => m.recipe_id !== null).length;

  /**
   * El botón que justifica el módulo entero: del menú sale la lista del súper.
   *
   * Toda la lógica —agrupar ingredientes repetidos, descontar la despensa, no
   * duplicar lo que ya está anotado— vive en la función de Postgres, en una
   * sola transacción. Hacerlo en el cliente serían decenas de idas y vueltas
   * y un resultado a medias si se corta la conexión en el medio.
   */
  async function generateList() {
    const superList = lists.find((l) => l.kind === "supermercado") ?? lists[0];
    if (!superList) {
      toast.error("No hay ninguna lista de compras donde volcar.");
      return;
    }

    setGenerating(true);
    const { data, error } = await createClient().rpc("generate_shopping_from_meals", {
      p_from: monday,
      p_to: sunday,
      p_list_id: superList.id,
    });
    setGenerating(false);

    if (error) {
      toast.error("No se pudo armar la lista.");
      return;
    }

    if (!data) {
      toast.info("Ya tenés anotado todo lo que hace falta.");
      return;
    }
    toast.success(
      `${data} ${data === 1 ? "cosa agregada" : "cosas agregadas"} a ${superList.name}.`,
    );
  }

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between gap-2">
        <Link
          href={`/comidas?semana=${addDaysIso(monday, -7)}`}
          aria-label="Semana anterior"
          className="grid size-10 place-items-center rounded-full text-muted hover:bg-surface-2"
        >
          <ChevronLeft className="size-5" />
        </Link>
        <div className="text-center">
          <h1 className="text-lg font-bold text-fg">Comidas</h1>
          <p className="text-xs text-muted">
            {formatDayLabel(monday)} al {formatDayLabel(sunday)}
          </p>
        </div>
        <Link
          href={`/comidas?semana=${addDaysIso(monday, 7)}`}
          aria-label="Semana siguiente"
          className="grid size-10 place-items-center rounded-full text-muted hover:bg-surface-2"
        >
          <ChevronRight className="size-5" />
        </Link>
      </header>

      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
        {(
          [
            { value: "menu", label: "Menú" },
            { value: "recetas", label: "Recetas" },
            { value: "despensa", label: "Despensa" },
          ] as const
        ).map((t) => (
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

      {tab === "menu" ? (
        <>
          <ol className="space-y-2">
            {days.map((day) => {
              const isToday = day === today;

              return (
                <li
                  key={day}
                  className={cn(
                    "rounded-app border bg-surface p-3",
                    isToday ? "border-primary" : "border-border",
                  )}
                >
                  <h2
                    className={cn(
                      "mb-2 text-sm font-bold capitalize",
                      isToday ? "text-primary" : "text-fg",
                    )}
                  >
                    {formatDayLabel(day)}
                    {isToday ? <span className="ml-1.5 font-medium">· hoy</span> : null}
                  </h2>

                  <div className="grid grid-cols-2 gap-2">
                    {MEAL_SLOTS.map((slot) => {
                      const meal = week.meals.find(
                        (m) => m.meal_date === day && m.slot === slot.value,
                      );

                      return (
                        <button
                          key={slot.value}
                          type="button"
                          onClick={() => setEditing({ date: day, slot: slot.value })}
                          className={cn(
                            "rounded-lg border p-2.5 text-left",
                            meal
                              ? "border-border bg-surface-2"
                              : "border-dashed border-border",
                          )}
                        >
                          <span className="block text-[11px] uppercase tracking-wide text-muted">
                            {slot.label}
                          </span>
                          {meal ? (
                            <span className="mt-0.5 block text-sm text-fg">
                              {mealLabel(meal)}
                              {meal.recipe?.minutes ? (
                                <span className="mt-0.5 flex items-center gap-1 text-xs text-muted">
                                  <Clock className="size-3" />
                                  {meal.recipe.minutes} min
                                </span>
                              ) : null}
                            </span>
                          ) : (
                            <span className="mt-0.5 block text-sm text-muted">
                              Sin decidir
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </li>
              );
            })}
          </ol>

          <Button
            size="lg"
            className="w-full"
            onClick={generateList}
            disabled={generating || plannedCount === 0}
          >
            <ShoppingCart />
            {generating ? "Armando..." : "Pasar a la lista del súper"}
          </Button>

          {plannedCount === 0 ? (
            <p className="text-center text-xs text-muted">
              Elegí al menos una receta de la semana para poder armar la lista.
            </p>
          ) : (
            <p className="text-center text-xs text-muted">
              Suma lo que falta según las recetas, descontando lo que ya hay en la despensa.
            </p>
          )}
        </>
      ) : null}

      {tab === "recetas" ? <RecipeList recipes={week.recipes} onChanged={refresh} /> : null}

      {tab === "despensa" ? (
        <PantryPanel items={week.pantry} today={today} lists={lists} onChanged={refresh} />
      ) : null}

      <Sheet open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        {editing ? (
          <SheetContent
            title={`${editing.slot === "almuerzo" ? "Almuerzo" : "Cena"} del ${formatDayLabel(editing.date)}`}
          >
            <MealSlotPicker
              date={editing.date}
              slot={editing.slot}
              recipes={week.recipes}
              current={week.meals.find(
                (m) => m.meal_date === editing.date && m.slot === editing.slot,
              )}
              onDone={() => {
                setEditing(null);
                refresh();
              }}
            />
          </SheetContent>
        ) : null}
      </Sheet>
    </div>
  );
}
