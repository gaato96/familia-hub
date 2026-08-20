import { notFound } from "next/navigation";

import { MemberRecordView } from "@/components/records/member-record-view";
import { requireParent } from "@/lib/auth/context";
import { fetchMemberRecord } from "@/lib/records/queries";
import { createClient } from "@/lib/supabase/server";

/**
 * Expediente de un integrante.
 *
 * `requireParent()` y no `requireFamily()`: acá está el DNI, la obra social y
 * la historia clínica. Es una compuerta de UX — lo que de verdad impide que un
 * `child` lea una fila son las policies de RLS, que exigen `is_parent()` en
 * todas estas tablas. Si esta línea desapareciera, la pantalla se vería vacía
 * en vez de filtrar datos.
 */
export default async function ExpedientePage({
  params,
}: {
  params: Promise<{ memberId: string }>;
}) {
  const { memberId } = await params;
  const { members } = await requireParent();

  const member = members.find((m) => m.id === memberId);
  if (!member) notFound();

  const supabase = await createClient();
  const record = await fetchMemberRecord(supabase, memberId);

  return <MemberRecordView member={member} record={record} />;
}
