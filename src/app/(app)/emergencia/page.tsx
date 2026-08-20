import { EmergencyCard } from "@/components/records/emergency-card";
import { requireFamily } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Emergencia" };

/**
 * Ficha de emergencia. La ve CUALQUIER integrante, incluidos los chicos:
 * es justamente el dato que sirve cuando el adulto no está.
 *
 * Los datos salen de `emergency_card()`, una función SECURITY DEFINER que
 * devuelve un subconjunto acotado del expediente (grupo sanguíneo, alergias,
 * condiciones, medicación activa) y nada más. Ni DNI, ni obra social, ni
 * historial de consultas.
 */
export default async function EmergenciaPage() {
  await requireFamily();
  const supabase = await createClient();

  const [cardResult, contactsResult] = await Promise.all([
    supabase.rpc("emergency_card"),
    supabase.from("contacts").select("*").eq("is_emergency", true).order("position"),
  ]);

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-fg">Emergencia</h1>
        <p className="text-sm text-muted">
          Esta pantalla funciona sin internet una vez que la abriste.
        </p>
      </header>

      <EmergencyCard
        members={cardResult.data ?? []}
        contacts={contactsResult.data ?? []}
        // Si la RPC falló, la página se renderizó sin datos frescos y el
        // componente tiene que caer al cache en vez de mostrar todo vacío.
        online={!cardResult.error}
      />
    </div>
  );
}
