/**
 * Espejo a mano de supabase/migrations/.
 *
 * No hay Docker en esta máquina, así que `supabase gen types` no corre: este
 * archivo se actualiza manualmente cada vez que una migración cambia el
 * esquema. Es tedioso y es el precio de no tener Docker — pero si se
 * desincroniza, el typecheck miente y los bugs aparecen recién en runtime.
 *
 * Las filas se declaran con `type`, NUNCA con `interface`: supabase-js exige
 * compatibilidad con `Record<string, unknown>`, y una `interface` no tiene
 * índice implícito — los tipos `Insert` se resuelven a `never` en silencio,
 * sin ningún error que apunte a la causa.
 */

/** Row con los campos que tienen default en la base marcados como opcionales. */
type WithDefaults<Row, K extends keyof Row> = Omit<Row, K> & Partial<Pick<Row, K>>;

type Stamps = "id" | "created_at" | "updated_at";

// ---------------------------------------------------------------------------
// Uniones que espejan los CHECK de la base
// ---------------------------------------------------------------------------
export type UserRole = "parent" | "child";
export type MemberKind = "user" | "dependent";
export type NoteColor = "yellow" | "pink" | "blue" | "green" | "orange" | "purple";
/** Escapes en vez de literales: los emoji viajan por heredocs y consolas de Windows. */
export type NoteEmoji =
  | "❤️"
  | "\u{1F44D}"
  | "\u{1F602}"
  | "\u{1F440}"
  | "\u{1F389}";
export type TaskCategory =
  | "hogar"
  | "limpieza"
  | "cocina"
  | "compras"
  | "tramites"
  | "julian"
  | "otros";
export type TaskPriority = "baja" | "normal" | "alta";
export type TaskStatus = "pending" | "done" | "skipped";
export type TaskStepKind = "do" | "dont";
export type EventCategory =
  | "familia"
  | "salud"
  | "escuela"
  | "trabajo"
  | "social"
  | "tramites"
  | "otros";
export type ShoppingListKind =
  | "supermercado"
  | "verduleria"
  | "farmacia"
  | "hogar"
  | "caprichos"
  | "regalos"
  | "general";

/** Las tres formas de recurrencia que soporta la app. Ver src/lib/tasks/recurrence.ts. */
export type Recurrence =
  | { freq: "days"; interval: number }
  | { freq: "weekly"; byweekday: number[] }
  | { freq: "monthly"; bymonthday: number };

// ---------------------------------------------------------------------------
// Filas
// ---------------------------------------------------------------------------
export type FamilyRow = {
  id: string;
  name: string;
  invite_code: string;
  timezone: string;
  created_at: string;
  updated_at: string;
};

export type ProfileRow = {
  id: string;
  family_id: string | null;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type FamilyMemberRow = {
  id: string;
  family_id: string;
  profile_id: string | null;
  kind: MemberKind;
  display_name: string;
  avatar_path: string | null;
  color: string;
  birth_date: string | null;
  position: number;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
};

export type PushSubscriptionRow = {
  id: string;
  family_id: string;
  profile_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  user_agent: string | null;
  created_at: string;
  last_seen_at: string;
};

export type NoteRow = {
  id: string;
  family_id: string;
  author_member_id: string;
  body: string;
  color: NoteColor;
  rotation: number;
  position: number;
  is_pinned: boolean;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
};

export type NoteReadRow = {
  note_id: string;
  member_id: string;
  family_id: string;
  read_at: string;
};

export type NoteReactionRow = {
  note_id: string;
  member_id: string;
  family_id: string;
  emoji: NoteEmoji;
  created_at: string;
};

export type TaskRow = {
  id: string;
  family_id: string;
  title: string;
  notes: string | null;
  category: TaskCategory;
  priority: TaskPriority;
  starts_on: string;
  recurrence: Recurrence | null;
  rotation_member_ids: string[];
  is_archived: boolean;
  created_by_member_id: string | null;
  created_at: string;
  updated_at: string;
};

export type TaskStepRow = {
  id: string;
  family_id: string;
  task_id: string;
  label: string;
  kind: TaskStepKind;
  position: number;
};

export type TaskInstanceRow = {
  id: string;
  family_id: string;
  task_id: string;
  due_date: string;
  assigned_member_id: string | null;
  status: TaskStatus;
  completed_at: string | null;
  completed_by_member_id: string | null;
  done_step_ids: string[];
  note: string | null;
  created_at: string;
  updated_at: string;
};

export type EventRow = {
  id: string;
  family_id: string;
  title: string;
  description: string | null;
  location: string | null;
  starts_at: string;
  ends_at: string | null;
  is_all_day: boolean;
  category: EventCategory;
  created_by_member_id: string | null;
  created_at: string;
  updated_at: string;
};

export type EventAttendeeRow = {
  event_id: string;
  member_id: string;
  family_id: string;
};

export type ShoppingListRow = {
  id: string;
  family_id: string;
  name: string;
  kind: ShoppingListKind;
  gift_for_member_id: string | null;
  position: number;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
};

export type ShoppingItemRow = {
  id: string;
  family_id: string;
  list_id: string;
  name: string;
  quantity: number | null;
  unit: string | null;
  note: string | null;
  url: string | null;
  est_price_cents: number | null;
  is_checked: boolean;
  checked_at: string | null;
  checked_by_member_id: string | null;
  is_frequent: boolean;
  position: number;
  added_by_member_id: string | null;
  created_at: string;
  updated_at: string;
};

// ---------------------------------------------------------------------------
// Fase 2 — expediente, documentos y contactos
// ---------------------------------------------------------------------------
export type BloodType = "A+" | "A-" | "B+" | "B-" | "AB+" | "AB-" | "O+" | "O-";

export type DocumentCategory =
  | "identidad"
  | "salud"
  | "escuela"
  | "vivienda"
  | "vehiculo"
  | "garantia"
  | "seguro"
  | "finanzas"
  | "otros";

export type ContactCategory =
  | "salud"
  | "urgencias"
  | "escuela"
  | "servicios"
  | "familia"
  | "otros";

export type SizeKind = "ropa" | "calzado" | "pantalon" | "abrigo" | "otro";

export type MemberDetailRow = {
  member_id: string;
  family_id: string;
  full_legal_name: string | null;
  dni: string | null;
  cuil: string | null;
  blood_type: BloodType | null;
  health_insurance: string | null;
  health_insurance_id: string | null;
  allergies: string | null;
  conditions: string | null;
  emergency_notes: string | null;
  address: string | null;
  birth_place: string | null;
  created_at: string;
  updated_at: string;
};

export type DocumentRow = {
  id: string;
  family_id: string;
  member_id: string | null;
  title: string;
  description: string | null;
  category: DocumentCategory;
  storage_path: string;
  mime_type: string;
  size_bytes: number;
  issued_on: string | null;
  expires_on: string | null;
  uploaded_by_member_id: string | null;
  created_at: string;
  updated_at: string;
};

export type MedicationRow = {
  id: string;
  family_id: string;
  member_id: string;
  name: string;
  dose: string | null;
  frequency: string | null;
  treats: string | null;
  notes: string | null;
  prescribed_by: string | null;
  started_on: string | null;
  ended_on: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type VaccineRow = {
  id: string;
  family_id: string;
  member_id: string;
  name: string;
  dose_label: string | null;
  applied_on: string | null;
  due_on: string | null;
  place: string | null;
  batch_number: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type MedicalVisitRow = {
  id: string;
  family_id: string;
  member_id: string;
  visited_on: string;
  specialty: string | null;
  professional: string | null;
  place: string | null;
  reason: string | null;
  diagnosis: string | null;
  indications: string | null;
  next_visit_on: string | null;
  created_at: string;
  updated_at: string;
};

export type GrowthRecordRow = {
  id: string;
  family_id: string;
  member_id: string;
  measured_on: string;
  /** Gramos enteros. Ver src/lib/records/measures.ts para el formato. */
  weight_grams: number | null;
  /** Milímetros enteros. */
  height_mm: number | null;
  head_circ_mm: number | null;
  notes: string | null;
  created_at: string;
};

export type MilestoneRow = {
  id: string;
  family_id: string;
  member_id: string;
  title: string;
  achieved_on: string;
  notes: string | null;
  created_at: string;
};

export type MemberSizeRow = {
  id: string;
  family_id: string;
  member_id: string;
  kind: SizeKind;
  value: string;
  notes: string | null;
  valid_from: string;
  created_at: string;
};

export type ContactRow = {
  id: string;
  family_id: string;
  name: string;
  role: string | null;
  phone: string | null;
  alt_phone: string | null;
  notes: string | null;
  category: ContactCategory;
  is_emergency: boolean;
  position: number;
  created_at: string;
  updated_at: string;
};

/** Lo que devuelve la función emergency_card(). */
export type EmergencyCardRow = {
  member_id: string;
  display_name: string;
  color: string;
  birth_date: string | null;
  blood_type: BloodType | null;
  allergies: string | null;
  conditions: string | null;
  emergency_notes: string | null;
  medications: string[];
};

// ---------------------------------------------------------------------------
// Database
// ---------------------------------------------------------------------------
/**
 * `Relationships` es obligatorio para supabase-js: es lo que le permite tipar
 * un select embebido como `*, task:tasks(...)`. Casi todas las tablas van con
 * `[]` porque no se embeben desde ellas; las que sí declaran su FK abajo.
 */
type Relationship = {
  foreignKeyName: string;
  columns: string[];
  isOneToOne?: boolean;
  referencedRelation: string;
  referencedColumns: string[];
};

type Table<
  Row,
  Defaulted extends keyof Row,
  Rels extends Relationship[] = [],
> = {
  Row: Row;
  Insert: WithDefaults<Row, Defaulted>;
  Update: Partial<Row>;
  Relationships: Rels;
};

/** task_instances -> tasks. La usa fetchTasksBetween() para traer el título. */
type TaskInstanceRelationships = [
  {
    foreignKeyName: "task_instances_task_id_fkey";
    columns: ["task_id"];
    isOneToOne: false;
    referencedRelation: "tasks";
    referencedColumns: ["id"];
  },
];

export type Database = {
  public: {
    Tables: {
      families: Table<FamilyRow, Stamps | "timezone" | "invite_code">;
      profiles: Table<ProfileRow, Stamps | "role" | "is_active" | "family_id">;
      family_members: Table<
        FamilyMemberRow,
        | Stamps
        | "family_id"
        | "kind"
        | "color"
        | "position"
        | "is_archived"
        | "avatar_path"
        | "birth_date"
        | "profile_id"
      >;
      push_subscriptions: Table<
        PushSubscriptionRow,
        "id" | "created_at" | "last_seen_at" | "user_agent"
      >;
      notes: Table<
        NoteRow,
        Stamps | "family_id" | "author_member_id" | "color" | "rotation" | "position" | "is_pinned" | "expires_at"
      >;
      note_reads: Table<NoteReadRow, "family_id" | "read_at">;
      note_reactions: Table<NoteReactionRow, "family_id" | "created_at">;
      tasks: Table<
        TaskRow,
        | Stamps
        | "family_id"
        | "notes"
        | "category"
        | "priority"
        | "starts_on"
        | "recurrence"
        | "rotation_member_ids"
        | "is_archived"
        | "created_by_member_id"
      >;
      task_steps: Table<TaskStepRow, "id" | "family_id" | "kind" | "position">;
      task_instances: Table<
        TaskInstanceRow,
        | Stamps
        | "assigned_member_id"
        | "status"
        | "completed_at"
        | "completed_by_member_id"
        | "done_step_ids"
        | "note",
        TaskInstanceRelationships
      >;
      events: Table<
        EventRow,
        | Stamps
        | "family_id"
        | "description"
        | "location"
        | "ends_at"
        | "is_all_day"
        | "category"
        | "created_by_member_id"
      >;
      event_attendees: Table<EventAttendeeRow, "family_id">;
      shopping_lists: Table<
        ShoppingListRow,
        Stamps | "family_id" | "kind" | "gift_for_member_id" | "position" | "is_archived"
      >;
      shopping_items: Table<
        ShoppingItemRow,
        | Stamps
        | "family_id"
        | "quantity"
        | "unit"
        | "note"
        | "url"
        | "est_price_cents"
        | "is_checked"
        | "checked_at"
        | "checked_by_member_id"
        | "is_frequent"
        | "position"
        | "added_by_member_id"
      >;

      // --- Fase 2 ---------------------------------------------------------
      member_details: Table<
        MemberDetailRow,
        | "family_id"
        | "created_at"
        | "updated_at"
        | "full_legal_name"
        | "dni"
        | "cuil"
        | "blood_type"
        | "health_insurance"
        | "health_insurance_id"
        | "allergies"
        | "conditions"
        | "emergency_notes"
        | "address"
        | "birth_place"
      >;
      documents: Table<
        DocumentRow,
        | Stamps
        | "family_id"
        | "member_id"
        | "description"
        | "category"
        | "issued_on"
        | "expires_on"
        | "uploaded_by_member_id"
      >;
      medications: Table<
        MedicationRow,
        | Stamps
        | "family_id"
        | "dose"
        | "frequency"
        | "treats"
        | "notes"
        | "prescribed_by"
        | "started_on"
        | "ended_on"
        | "is_active"
      >;
      vaccines: Table<
        VaccineRow,
        | Stamps
        | "family_id"
        | "dose_label"
        | "applied_on"
        | "due_on"
        | "place"
        | "batch_number"
        | "notes"
      >;
      medical_visits: Table<
        MedicalVisitRow,
        | Stamps
        | "family_id"
        | "specialty"
        | "professional"
        | "place"
        | "reason"
        | "diagnosis"
        | "indications"
        | "next_visit_on"
      >;
      growth_records: Table<
        GrowthRecordRow,
        | "id"
        | "created_at"
        | "family_id"
        | "weight_grams"
        | "height_mm"
        | "head_circ_mm"
        | "notes"
      >;
      milestones: Table<MilestoneRow, "id" | "created_at" | "family_id" | "notes">;
      member_sizes: Table<
        MemberSizeRow,
        "id" | "created_at" | "family_id" | "notes" | "valid_from"
      >;
      contacts: Table<
        ContactRow,
        | Stamps
        | "family_id"
        | "role"
        | "phone"
        | "alt_phone"
        | "notes"
        | "category"
        | "is_emergency"
        | "position"
      >;
    };
    Views: Record<string, never>;
    Functions: {
      create_family: {
        Args: { p_family_name: string; p_display_name: string };
        Returns: string;
      };
      join_family: {
        Args: { p_invite_code: string; p_display_name: string };
        Returns: string;
      };
      set_member_role: {
        Args: { p_profile_id: string; p_role: UserRole };
        Returns: undefined;
      };
      rotate_invite_code: { Args: Record<string, never>; Returns: string };
      ensure_task_instances: {
        Args: { p_until: string; p_family_id?: string };
        Returns: number;
      };
      clear_checked_items: { Args: { p_list_id: string }; Returns: number };
      /**
       * SECURITY DEFINER: es la única puerta por la que un `child` ve datos
       * del expediente, y solo el subconjunto que sirve en una guardia.
       */
      emergency_card: { Args: Record<string, never>; Returns: EmergencyCardRow[] };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
