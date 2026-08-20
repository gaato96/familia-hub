import { HouseDocuments } from "@/components/records/house-documents";
import { requireParent } from "@/lib/auth/context";
import { fetchHouseDocuments } from "@/lib/records/queries";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Papeles de la casa" };

/**
 * Caja fuerte documental de la casa: contrato de alquiler, garantías, seguros.
 *
 * Es la misma tabla `documents` que el expediente de cada persona; lo único
 * que cambia es que estas filas tienen `member_id = null`.
 */
export default async function DocumentosPage() {
  const { family } = await requireParent();
  const supabase = await createClient();
  const documents = await fetchHouseDocuments(supabase);

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-fg">Papeles de la casa</h1>
        <p className="text-sm text-muted">
          Contratos, garantías y comprobantes. Solo los ven los adultos.
        </p>
      </header>

      <HouseDocuments documents={documents} familyId={family.id} />
    </div>
  );
}
