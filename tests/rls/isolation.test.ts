import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";

import "dotenv/config";

import type { Database } from "@/types/database";

/**
 * EL test del proyecto.
 *
 * Todo lo demás que falle es una molestia; esto que falle es que una familia
 * ve el DNI, los remedios y los gastos de otra. Por eso barre TODAS las tablas
 * de tenant en vez de confiar en que las policies se escribieron con el mismo
 * criterio, y prueba las dos direcciones: que cada uno ve lo suyo Y que no ve
 * nada de lo ajeno. Un bug de RLS que devuelve cero filas para todos pasaría
 * una prueba que solo mire "no ve lo del otro".
 *
 * Corre contra el proyecto REAL (no hay Docker en esta máquina). Requiere
 * `npm run db:seed` antes. No correrlo contra un proyecto con datos de verdad.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const PASSWORD = "familia-de-prueba-2026";

/**
 * `families` queda afuera: su columna de tenant es `id`, no `family_id`, y
 * tiene su propio caso abajo.
 */
const TENANT_TABLES = [
  "family_members",
  "notes",
  "tasks",
  "task_steps",
  "task_instances",
  "events",
  "shopping_lists",
  "shopping_items",
] as const;

type Client = SupabaseClient<Database>;

/**
 * El nombre de tabla es dinámico, así que postgrest-js no puede tipar el
 * select: se acota con un cast a una tabla cualquiera de la lista. Todas
 * tienen `family_id` — es justamente lo que define a una tabla de tenant.
 */
async function familyIdsIn(client: Client, table: (typeof TENANT_TABLES)[number]) {
  const { data, error } = await client.from(table as "notes").select("family_id");
  if (error) throw new Error(`${table}: ${error.message}`);
  return (data ?? []).map((row) => row.family_id);
}

/**
 * Entra y verifica que el token traiga los claims de tenant.
 *
 * El chequeo explícito no es paranoia: un token sin `family_id` hace que todas
 * las queries devuelvan cero filas, y el test revienta más adelante con un
 * `Cannot read properties of null` que no dice nada. Las dos causas reales son
 * el hook de Custom Access Token apagado en el Dashboard —el error de setup
 * más común del proyecto— y un token emitido antes de que el usuario tuviera
 * familia.
 */
async function signIn(email: string): Promise<Client> {
  const client = createClient<Database>(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw new Error(`No se pudo entrar como ${email}: ${error.message}`);

  const { data } = await client.auth.getClaims();
  const familyId = data?.claims.family_id;

  if (typeof familyId !== "string" || !familyId) {
    throw new Error(
      `El token de ${email} no trae el claim family_id. ` +
        "Revisá que el Custom Access Token Hook esté habilitado en " +
        "Dashboard -> Authentication -> Hooks, y que corriste `npm run db:seed`.",
    );
  }

  return client;
}

describe("aislamiento entre familias", () => {
  let uno: Client;
  let dos: Client;
  let hijo: Client;
  let unoFamilyId: string;
  let dosFamilyId: string;

  beforeAll(async () => {
    [uno, dos, hijo] = await Promise.all([
      signIn("uno.mama@test.local"),
      signIn("dos.papa@test.local"),
      signIn("uno.hijo@test.local"),
    ]);

    const [resultUno, resultDos] = await Promise.all([
      uno.from("families").select("id").single(),
      dos.from("families").select("id").single(),
    ]);

    if (!resultUno.data || !resultDos.data) {
      throw new Error(
        "Alguna de las dos familias de prueba no existe. Corré `npm run db:seed`. " +
          `(uno: ${resultUno.error?.message ?? "ok"}, dos: ${resultDos.error?.message ?? "ok"})`,
      );
    }

    unoFamilyId = resultUno.data.id;
    dosFamilyId = resultDos.data.id;
    expect(unoFamilyId).not.toBe(dosFamilyId);
  }, 30_000);

  it.each(TENANT_TABLES)("%s: cada familia ve solo sus propias filas", async (table) => {
    const [idsUno, idsDos] = await Promise.all([
      familyIdsIn(uno, table),
      familyIdsIn(dos, table),
    ]);

    // Ambas tienen que ver ALGO: si el hook de claims estuviera apagado, las
    // dos verían cero filas y un test que solo mire "no ve lo del otro"
    // pasaría en verde con la app completamente rota.
    expect(idsUno.length).toBeGreaterThan(0);
    expect(idsDos.length).toBeGreaterThan(0);

    expect(new Set(idsUno)).toEqual(new Set([unoFamilyId]));
    expect(new Set(idsDos)).toEqual(new Set([dosFamilyId]));
  });

  it("families: cada uno ve exactamente una familia, la suya", async () => {
    const [{ data: rowsUno }, { data: rowsDos }] = await Promise.all([
      uno.from("families").select("id"),
      dos.from("families").select("id"),
    ]);

    expect(rowsUno).toHaveLength(1);
    expect(rowsDos).toHaveLength(1);
    expect(rowsUno![0].id).toBe(unoFamilyId);
    expect(rowsDos![0].id).toBe(dosFamilyId);
  });

  it("una familia no puede leer una fila de la otra ni pidiéndola por id", async () => {
    const { data: notaDos } = await dos.from("notes").select("id").limit(1).single();

    const { data } = await uno.from("notes").select("*").eq("id", notaDos!.id);
    expect(data).toEqual([]);
  });

  it("no se puede escribir en la familia ajena forzando el family_id", async () => {
    // El trigger set_family_id solo completa cuando viene null, así que este
    // insert llega a la policy con el family_id de la otra casa — y tiene que
    // rebotar ahí.
    const { error } = await uno.from("notes").insert({
      family_id: dosFamilyId,
      body: "Esto no debería existir",
    });

    expect(error).not.toBeNull();
  });

  it("un integrante no puede auto-promoverse a adulto", async () => {
    const { data: profile } = await hijo
      .from("profiles")
      .select("id, role")
      .eq("role", "child")
      .limit(1)
      .single();

    expect(profile?.role).toBe("child");

    // Sin policy de UPDATE sobre profiles: el update no afecta ninguna fila.
    await hijo.from("profiles").update({ role: "parent" }).eq("id", profile!.id);

    const { data: after } = await hijo
      .from("profiles")
      .select("role")
      .eq("id", profile!.id)
      .single();

    expect(after?.role).toBe("child");
  });

  it("la RPC de cambio de rol rechaza a quien no es adulto", async () => {
    const { data: otro } = await hijo
      .from("profiles")
      .select("id")
      .neq("role", "child")
      .limit(1)
      .single();

    const { error } = await hijo.rpc("set_member_role", {
      p_profile_id: otro!.id,
      p_role: "child",
    });

    expect(error).not.toBeNull();
  });

  it("un adulto no puede cambiar su propio rol", async () => {
    const { data: claims } = await uno.auth.getClaims();
    const { error } = await uno.rpc("set_member_role", {
      p_profile_id: claims!.claims.sub,
      p_role: "child",
    });

    expect(error?.message).toContain("tu propio rol");
  });

  it("clear_checked_items no toca la lista de otra familia", async () => {
    const { data: listaDos } = await dos
      .from("shopping_lists")
      .select("id")
      .limit(1)
      .single();

    const { error } = await uno.rpc("clear_checked_items", { p_list_id: listaDos!.id });
    expect(error).not.toBeNull();
  });

  it("ensure_task_instances ignora el family_id que le pase un usuario", async () => {
    // El parámetro solo lo honra el service role. Un usuario autenticado
    // siempre genera para SU familia, aunque mande el id de la otra.
    const before = await dos
      .from("task_instances")
      .select("id", { count: "exact", head: true });

    await uno.rpc("ensure_task_instances", {
      p_until: new Date(Date.now() + 60 * 86_400_000).toISOString().slice(0, 10),
      p_family_id: dosFamilyId,
    });

    const after = await dos
      .from("task_instances")
      .select("id", { count: "exact", head: true });

    expect(after.count).toBe(before.count);
  });

  it("storage: no se puede listar la carpeta de otra familia", async () => {
    const { data } = await uno.storage.from("avatars").list(dosFamilyId);
    expect(data ?? []).toEqual([]);
  });

  // -------------------------------------------------------------------------
  // Fase 2 — expediente
  //
  // Acá el riesgo no es solo cruzar familias: es que un `child` de la MISMA
  // casa lea el DNI o la historia clínica de otro. Las policies del expediente
  // exigen is_parent(), a diferencia de las del planner.
  // -------------------------------------------------------------------------
  const RECORD_TABLES = [
    "member_details",
    "documents",
    "medications",
    "vaccines",
    "medical_visits",
    "growth_records",
    "milestones",
    "member_sizes",
  ] as const;

  it.each(RECORD_TABLES)("%s: un integrante no lee el expediente", async (table) => {
    const { data, error } = await hijo.from(table as "medications").select("*");

    // RLS no da error: simplemente no devuelve filas. Un error acá querría
    // decir que la tabla no existe o que la policy está mal escrita.
    expect(error).toBeNull();
    expect(data ?? []).toEqual([]);
  });

  it.each(RECORD_TABLES)("%s: un integrante tampoco puede escribir", async (table) => {
    const { error } = await hijo
      .from(table as "milestones")
      .insert({ member_id: "00000000-0000-0000-0000-000000000000" } as never);

    expect(error).not.toBeNull();
  });

  it("contacts: la excepción — los lee toda la casa", async () => {
    // Es el dato que sirve justamente cuando el adulto no está, así que un
    // `child` TIENE que poder leerlo aunque el resto del expediente esté
    // cerrado. Si esto empieza a fallar, alguien metió contacts en el bucle
    // de policies de arriba.
    const { data, error } = await hijo.from("contacts").select("id");
    expect(error).toBeNull();
    expect(data).not.toBeNull();
  });

  it("contacts: pero un integrante no los edita", async () => {
    const { error } = await hijo.from("contacts").insert({ name: "No debería entrar" });
    expect(error).not.toBeNull();
  });

  it("emergency_card: un integrante ve la ficha, y solo lo que va en la ficha", async () => {
    const { data, error } = await hijo.rpc("emergency_card");

    expect(error).toBeNull();
    expect((data ?? []).length).toBeGreaterThan(0);

    // La función es SECURITY DEFINER: la garantía es que devuelva EXACTAMENTE
    // estas columnas. Si alguien agrega `dni` a member_details y lo suma acá
    // sin pensar, este test lo frena.
    const keys = Object.keys((data ?? [])[0] ?? {}).sort();
    expect(keys).toEqual(
      [
        "allergies",
        "birth_date",
        "blood_type",
        "color",
        "conditions",
        "display_name",
        "emergency_notes",
        "medications",
        "member_id",
      ].sort(),
    );
  });

  it("emergency_card: nunca cruza de familia", async () => {
    const [{ data: fichaUno }, { data: fichaDos }] = await Promise.all([
      uno.rpc("emergency_card"),
      dos.rpc("emergency_card"),
    ]);

    const idsUno = new Set((fichaUno ?? []).map((r) => r.member_id));
    const idsDos = new Set((fichaDos ?? []).map((r) => r.member_id));

    for (const id of idsDos) expect(idsUno.has(id)).toBe(false);
  });

  it("storage: un integrante no puede listar los papeles de su propia casa", async () => {
    const { data } = await hijo.storage.from("family-docs").list(unoFamilyId);
    expect(data ?? []).toEqual([]);
  });
});
