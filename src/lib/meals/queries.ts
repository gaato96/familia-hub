import type { SupabaseClient } from "@supabase/supabase-js";

import type { IsoDate } from "@/lib/dates";
import type {
  Database,
  MealPlanRow,
  PantryItemRow,
  RecipeRow,
} from "@/types/database";

/** El menú de la semana, con el título de la receta ya resuelto. */
export type PlannedMeal = MealPlanRow & {
  recipe: Pick<RecipeRow, "title" | "minutes"> | null;
};

export type WeekMeals = {
  meals: PlannedMeal[];
  recipes: RecipeRow[];
  pantry: PantryItemRow[];
};

export async function fetchWeekMeals(
  supabase: SupabaseClient<Database>,
  from: IsoDate,
  to: IsoDate,
): Promise<WeekMeals> {
  const [meals, recipes, pantry] = await Promise.all([
    supabase
      .from("meal_plan")
      .select("*, recipe:recipes(title, minutes)")
      .gte("meal_date", from)
      .lte("meal_date", to)
      .order("meal_date", { ascending: true }),
    supabase
      .from("recipes")
      .select("*")
      // Los favoritos primero: son los que se eligen el 80% de las veces.
      .order("is_favorite", { ascending: false })
      .order("title", { ascending: true }),
    supabase
      .from("pantry_items")
      .select("*")
      .order("location", { ascending: true })
      .order("name", { ascending: true }),
  ]);

  return {
    meals: (meals.data ?? []) as PlannedMeal[],
    recipes: recipes.data ?? [],
    pantry: pantry.data ?? [],
  };
}

export const MEAL_SLOTS = [
  { value: "almuerzo", label: "Almuerzo" },
  { value: "cena", label: "Cena" },
] as const;

/** Lo que muestra una celda del menú: el título de la receta o el texto libre. */
export function mealLabel(meal: PlannedMeal): string {
  return meal.recipe?.title ?? meal.free_text ?? "";
}
