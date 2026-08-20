import { ContactsPanel } from "@/components/records/contacts-panel";
import { requireFamily } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Contactos" };

/**
 * Directorio de la casa. Lo LEE cualquiera —incluidos los chicos— y lo edita
 * un adulto: es el dato que sirve justamente cuando el adulto no está.
 */
export default async function ContactosPage() {
  const { role } = await requireFamily();
  const supabase = await createClient();

  const { data } = await supabase.from("contacts").select("*").order("position");

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-fg">Contactos</h1>
        <p className="text-sm text-muted">Tocá un contacto para llamarlo.</p>
      </header>

      <ContactsPanel contacts={data ?? []} isParent={role === "parent"} />
    </div>
  );
}
