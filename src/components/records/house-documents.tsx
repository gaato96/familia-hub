"use client";

import { useRouter } from "next/navigation";

import { DocumentList } from "@/components/records/document-list";
import type { DocumentRow } from "@/types/database";

/**
 * Envoltorio de cliente para la lista de papeles de la casa.
 *
 * Existe solo porque `DocumentList` necesita un callback `onChanged` y una
 * función no se puede pasar desde un Server Component. Acá se resuelve con
 * `router.refresh()`, que vuelve a pedir la página al servidor: es lo correcto
 * para una lista que no cambia mientras uno la mira, a diferencia de las notas
 * o las compras, que sí necesitan Realtime.
 */
export function HouseDocuments({
  documents,
  familyId,
}: {
  documents: DocumentRow[];
  familyId: string;
}) {
  const router = useRouter();

  return (
    <DocumentList
      documents={documents}
      memberId={null}
      familyId={familyId}
      onChanged={() => router.refresh()}
    />
  );
}
