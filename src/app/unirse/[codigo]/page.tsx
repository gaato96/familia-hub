import { Home } from "lucide-react";
import { redirect } from "next/navigation";

import { OnboardingForm } from "@/components/auth/onboarding-form";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Unirte a la familia" };

/**
 * Link de invitación. Precarga el código para que el que lo recibe no tenga
 * que tipearlo — que es exactamente donde se pierde la gente.
 *
 * Sin sesión, manda a registrarse conservando el código en `next`, así vuelve
 * acá solo después de crear la cuenta.
 */
export default async function UnirsePage({
  params,
}: {
  params: Promise<{ codigo: string }>;
}) {
  const { codigo } = await params;
  const code = codigo.toUpperCase().slice(0, 6);

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;

  if (!claims?.sub) {
    redirect(`/registro?next=${encodeURIComponent(`/unirse/${code}`)}`);
  }
  if (claims.family_id) redirect("/");

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-8 px-5 py-12">
      <header className="flex flex-col items-center gap-3 text-center">
        <div className="grid size-14 place-items-center rounded-2xl bg-primary text-primary-fg">
          <Home className="size-7" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-fg">Te invitaron a una casa</h1>
          <p className="mt-1 text-sm text-muted">Decinos cómo te llamás y entrás.</p>
        </div>
      </header>

      <OnboardingForm initialCode={code} />
    </main>
  );
}
