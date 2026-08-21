import { MealsView } from "@/components/comidas/meals-view";
import { requireFamily } from "@/lib/auth/context";
import { addDaysIso, startOfWeekAr, todayInAr, type IsoDate } from "@/lib/dates";
import { fetchWeekMeals } from "@/lib/meals/queries";
import { fetchLists } from "@/lib/shopping/queries";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Comidas" };

/**
 * Menú semanal, recetas y despensa.
 *
 * A diferencia del expediente y de finanzas, esta pantalla la ve toda la casa:
 * que un chico pueda anotar que quiere milanesas el jueves, o avisar que se
 * acabó la leche, es justamente el punto.
 *
 * La semana va por la URL y arranca el lunes, igual que el planner.
 */
export default async function ComidasPage({
  searchParams,
}: {
  searchParams: Promise<{ semana?: string }>;
}) {
  const { semana } = await searchParams;
  await requireFamily();

  const today = todayInAr();
  const monday = startOfWeekAr(isIsoDate(semana) ? semana : today);
  const sunday = addDaysIso(monday, 6);

  const supabase = await createClient();
  const [week, lists] = await Promise.all([
    fetchWeekMeals(supabase, monday, sunday),
    fetchLists(supabase),
  ]);

  return <MealsView monday={monday} today={today} week={week} lists={lists} />;
}

function isIsoDate(value: string | undefined): value is IsoDate {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}
