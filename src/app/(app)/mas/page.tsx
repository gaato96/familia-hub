import { SettingsPanel } from "@/components/app/settings-panel";
import { requireFamily } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Más" };

export default async function MasPage() {
  const { role } = await requireFamily();

  // getUser() y no getClaims(): el email no viaja en los claims propios, así
  // que acá sí hace falta el viaje al servidor de auth.
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  return <SettingsPanel email={data.user?.email ?? ""} isParent={role === "parent"} />;
}
