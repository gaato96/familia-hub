import { ShoppingView } from "@/components/shopping/shopping-view";
import { requireFamily } from "@/lib/auth/context";
import { fetchItems, fetchLists } from "@/lib/shopping/queries";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Compras" };

export default async function ComprasPage() {
  const { members } = await requireFamily();
  const supabase = await createClient();

  // Se traen TODOS los ítems de todas las listas de una: son decenas, no miles,
  // y tenerlos en memoria hace que cambiar de pestaña sea instantáneo en vez de
  // pedir una query por toque.
  const [lists, items] = await Promise.all([fetchLists(supabase), fetchItems(supabase)]);

  return <ShoppingView lists={lists} initialItems={items} members={members} />;
}
