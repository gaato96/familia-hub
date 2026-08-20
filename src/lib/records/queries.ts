import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  Database,
  DocumentRow,
  GrowthRecordRow,
  MedicalVisitRow,
  MedicationRow,
  MemberDetailRow,
  MemberSizeRow,
  MilestoneRow,
  VaccineRow,
} from "@/types/database";

/**
 * Lecturas del expediente. Ninguna filtra por family_id — lo hace RLS, que
 * además exige `is_parent()` en todas estas tablas.
 */

export type MemberRecord = {
  details: MemberDetailRow | null;
  medications: MedicationRow[];
  vaccines: VaccineRow[];
  visits: MedicalVisitRow[];
  growth: GrowthRecordRow[];
  milestones: MilestoneRow[];
  sizes: MemberSizeRow[];
  documents: DocumentRow[];
};

export async function fetchMemberRecord(
  supabase: SupabaseClient<Database>,
  memberId: string,
): Promise<MemberRecord> {
  // Ocho lecturas en paralelo. Encadenarlas serían ocho viajes a São Paulo
  // antes de poder pintar nada; en paralelo es uno solo de latencia.
  const [details, medications, vaccines, visits, growth, milestones, sizes, documents] =
    await Promise.all([
      supabase.from("member_details").select("*").eq("member_id", memberId).maybeSingle(),
      supabase
        .from("medications")
        .select("*")
        .eq("member_id", memberId)
        // Los activos primero: es lo que se consulta el 95% de las veces.
        .order("is_active", { ascending: false })
        .order("name", { ascending: true }),
      supabase
        .from("vaccines")
        .select("*")
        .eq("member_id", memberId)
        .order("applied_on", { ascending: false, nullsFirst: true }),
      supabase
        .from("medical_visits")
        .select("*")
        .eq("member_id", memberId)
        .order("visited_on", { ascending: false }),
      supabase
        .from("growth_records")
        .select("*")
        .eq("member_id", memberId)
        .order("measured_on", { ascending: false }),
      supabase
        .from("milestones")
        .select("*")
        .eq("member_id", memberId)
        .order("achieved_on", { ascending: false }),
      supabase
        .from("member_sizes")
        .select("*")
        .eq("member_id", memberId)
        .order("valid_from", { ascending: false }),
      supabase
        .from("documents")
        .select("*")
        .eq("member_id", memberId)
        .order("created_at", { ascending: false }),
    ]);

  return {
    details: details.data ?? null,
    medications: medications.data ?? [],
    vaccines: vaccines.data ?? [],
    visits: visits.data ?? [],
    growth: growth.data ?? [],
    milestones: milestones.data ?? [],
    sizes: sizes.data ?? [],
    documents: documents.data ?? [],
  };
}

/** Documentos de la casa: los que no pertenecen a ninguna persona. */
export async function fetchHouseDocuments(
  supabase: SupabaseClient<Database>,
): Promise<DocumentRow[]> {
  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .is("member_id", null)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

/**
 * El talle vigente de cada tipo.
 *
 * `member_sizes` guarda historial, así que "el talle de zapatilla" es la fila
 * más reciente de kind='calzado'. Se resuelve en TS y no con un DISTINCT ON en
 * SQL porque son diez filas por persona: no vale una vista para eso.
 */
export function currentSizes(sizes: MemberSizeRow[]): MemberSizeRow[] {
  const seen = new Set<string>();
  // Vienen ordenadas por valid_from desc, así que la primera de cada kind gana.
  return sizes.filter((size) => {
    if (seen.has(size.kind)) return false;
    seen.add(size.kind);
    return true;
  });
}

/**
 * Genera una URL firmada para ver un documento.
 *
 * 60 segundos: alcanza para que el navegador cargue la imagen o abra el PDF, y
 * si el link se filtra (historial, captura, alguien mirando la pantalla) deja
 * de servir enseguida. Un bucket privado con URLs de una hora es un bucket
 * público con pasos extra.
 */
export async function signedUrlFor(
  supabase: SupabaseClient<Database>,
  storagePath: string,
): Promise<string | null> {
  const { data } = await supabase.storage
    .from("family-docs")
    .createSignedUrl(storagePath, 60);

  return data?.signedUrl ?? null;
}

export const DOCUMENT_CATEGORIES = [
  { value: "identidad", label: "Identidad" },
  { value: "salud", label: "Salud" },
  { value: "escuela", label: "Escuela" },
  { value: "vivienda", label: "Vivienda" },
  { value: "vehiculo", label: "Vehículo" },
  { value: "garantia", label: "Garantías" },
  { value: "seguro", label: "Seguros" },
  { value: "finanzas", label: "Finanzas" },
  { value: "otros", label: "Otros" },
] as const;

export const CONTACT_CATEGORIES = [
  { value: "urgencias", label: "Urgencias" },
  { value: "salud", label: "Salud" },
  { value: "escuela", label: "Escuela" },
  { value: "servicios", label: "Servicios" },
  { value: "familia", label: "Familia" },
  { value: "otros", label: "Otros" },
] as const;
