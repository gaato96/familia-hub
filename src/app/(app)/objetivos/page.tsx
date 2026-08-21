import { GoalsView } from "@/components/objetivos/goals-view";
import { PageHeader } from "@/components/ui/page-header";
import { requireFamily } from "@/lib/auth/context";
import { todayInAr } from "@/lib/dates";
import { fetchGoals } from "@/lib/goals/queries";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Objetivos" };

/**
 * Objetivos de la casa.
 *
 * A diferencia de finanzas y del expediente, esta pantalla NO es solo de
 * adultos: el sentido del módulo es que cualquiera pueda agarrar un paso que
 * no es suyo, y pedir permiso para ayudar no tiene sentido.
 */
export default async function ObjetivosPage() {
  const { members } = await requireFamily();
  const supabase = await createClient();
  const goals = await fetchGoals(supabase);

  return (
    <>
      <PageHeader
        title="Objetivos"
        subtitle="Lo que la casa se propuso, partido en pasos que alguien puede agarrar."
      />
      <GoalsView goals={goals} members={members} today={todayInAr()} />
    </>
  );
}
