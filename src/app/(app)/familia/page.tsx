import { FamilyPanel } from "@/components/family/family-panel";
import { requireFamily } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "La familia" };

export default async function FamiliaPage() {
  const { family, members, member, role } = await requireFamily();
  const supabase = await createClient();

  // Los roles viven en `profiles`, no en `family_members`: se leen aparte para
  // poder mostrar quién es adulto y quién no. RLS ya limita a esta familia.
  const { data: profiles } = await supabase.from("profiles").select("id, role, is_active");

  return (
    <FamilyPanel
      family={family}
      members={members}
      currentMemberId={member.id}
      isParent={role === "parent"}
      profiles={profiles ?? []}
    />
  );
}
