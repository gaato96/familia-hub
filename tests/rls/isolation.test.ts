import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

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

  it("storage: tampoco se puede BAJAR una foto de la otra familia", async () => {
    // Listar vacío no alcanza como prueba: la ruta de un avatar es adivinable
    // hasta cierto punto (family_id/member_id/uuid) y `/api/avatar/[id]` la
    // arma sola. Lo que tiene que fallar es la descarga directa.
    const path = `${dosFamilyId}/${crypto.randomUUID()}/foto.webp`;
    const bytes = new Blob([new Uint8Array([1, 2, 3])], { type: "image/webp" });

    const subida = await dos.storage.from("avatars").upload(path, bytes);
    expect(subida.error).toBeNull();

    const { data, error } = await uno.storage.from("avatars").download(path);
    expect(data).toBeNull();
    expect(error).not.toBeNull();

    await dos.storage.from("avatars").remove([path]);
  });

  it("storage: y no se puede escribir en la carpeta de la otra familia", async () => {
    const path = `${dosFamilyId}/${crypto.randomUUID()}/intruso.webp`;
    const bytes = new Blob([new Uint8Array([1, 2, 3])], { type: "image/webp" });

    const { error } = await uno.storage.from("avatars").upload(path, bytes);
    expect(error).not.toBeNull();
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

  // -------------------------------------------------------------------------
  // Fase 3 — finanzas
  //
  // Mismo criterio que el expediente: cuánto gana cada uno y cuánto se debe no
  // es información para los chicos de la casa.
  // -------------------------------------------------------------------------
  const FINANCE_TABLES = ["income_entries", "budget_allocations", "expenses"] as const;

  it.each(FINANCE_TABLES)("%s: cada familia ve solo lo suyo", async (table) => {
    const [{ data: rowsUno }, { data: rowsDos }] = await Promise.all([
      uno.from(table as "expenses").select("family_id"),
      dos.from(table as "expenses").select("family_id"),
    ]);

    expect((rowsUno ?? []).length).toBeGreaterThan(0);
    expect((rowsDos ?? []).length).toBeGreaterThan(0);
    expect(new Set((rowsUno ?? []).map((r) => r.family_id))).toEqual(new Set([unoFamilyId]));
    expect(new Set((rowsDos ?? []).map((r) => r.family_id))).toEqual(new Set([dosFamilyId]));
  });

  it.each(FINANCE_TABLES)("%s: un integrante no ve las finanzas", async (table) => {
    const { data, error } = await hijo.from(table as "expenses").select("*");
    expect(error).toBeNull();
    expect(data ?? []).toEqual([]);
  });

  it("un integrante tampoco puede cargar un gasto", async () => {
    const { error } = await hijo.from("expenses").insert({
      label: "No deberia entrar",
      amount_cents: 1000,
      due_date: "2026-12-01",
    });

    expect(error).not.toBeNull();
  });

  // -------------------------------------------------------------------------
  // Fase 4 — comidas
  //
  // Acá el criterio se invierte: comer es de toda la casa. Que un chico pueda
  // anotar que quiere milanesas el jueves, o avisar que se acabó la leche, es
  // el punto del módulo.
  // -------------------------------------------------------------------------
  const MEAL_TABLES = ["recipes", "recipe_ingredients", "pantry_items", "meal_plan"] as const;

  it.each(MEAL_TABLES)("%s: cada familia ve solo lo suyo", async (table) => {
    const [{ data: rowsUno }, { data: rowsDos }] = await Promise.all([
      uno.from(table as "recipes").select("family_id"),
      dos.from(table as "recipes").select("family_id"),
    ]);

    expect((rowsUno ?? []).length).toBeGreaterThan(0);
    expect((rowsDos ?? []).length).toBeGreaterThan(0);
    expect(new Set((rowsUno ?? []).map((r) => r.family_id))).toEqual(new Set([unoFamilyId]));
    expect(new Set((rowsDos ?? []).map((r) => r.family_id))).toEqual(new Set([dosFamilyId]));
  });

  it.each(MEAL_TABLES)("%s: un integrante SÍ las ve", async (table) => {
    const { data, error } = await hijo.from(table as "recipes").select("family_id");

    expect(error).toBeNull();
    expect((data ?? []).length).toBeGreaterThan(0);
    expect(new Set((data ?? []).map((r) => r.family_id))).toEqual(new Set([unoFamilyId]));
  });

  it("un integrante puede anotar qué quiere comer", async () => {
    const { error } = await hijo.from("meal_plan").insert({
      meal_date: "2027-01-15",
      slot: "cena",
      free_text: "Milanesas",
    });

    expect(error).toBeNull();
    await hijo.from("meal_plan").delete().eq("meal_date", "2027-01-15");
  });

  it("generate_shopping_from_meals rechaza una lista de otra familia", async () => {
    const { data: listaDos } = await dos
      .from("shopping_lists")
      .select("id")
      .limit(1)
      .single();

    const { error } = await uno.rpc("generate_shopping_from_meals", {
      p_from: "2026-01-01",
      p_to: "2026-12-31",
      p_list_id: listaDos!.id,
    });

    expect(error).not.toBeNull();
  });

  // -------------------------------------------------------------------------
  // Fase 5 — objetivos y bloques de horarios
  //
  // Mismo criterio que comidas: son de toda la casa. Un chico tiene que poder
  // agarrar un paso de un objetivo y ver a qué hora vuelve el padre.
  //
  // A diferencia de las fases anteriores, estos casos NO dependen de la
  // semilla: crean sus propias filas y las borran. Es a propósito — así el
  // test también ejercita el trigger que estampa el family_id y el que estampa
  // el autor, que es justo donde se rompería el aislamiento.
  // -------------------------------------------------------------------------
  describe("objetivos y bloques", () => {
    let goalUno: string;
    let goalDos: string;
    let blockUno: string;

    beforeAll(async () => {
      const [a, b, c] = await Promise.all([
        uno.from("goals").insert({ title: "Objetivo de la uno" }).select("id").single(),
        dos.from("goals").insert({ title: "Objetivo de la dos" }).select("id").single(),
        uno
          .from("time_blocks")
          .insert({
            title: "Trabajo de prueba",
            starts_at: "09:00",
            ends_at: "18:00",
            weekdays: [1, 2, 3, 4, 5],
          })
          .select("id")
          .single(),
      ]);

      if (a.error || b.error || c.error) {
        throw new Error(
          `No se pudieron crear las filas de prueba: ${
            a.error?.message ?? b.error?.message ?? c.error?.message
          }`,
        );
      }

      goalUno = a.data!.id;
      goalDos = b.data!.id;
      blockUno = c.data!.id;
    }, 30_000);

    afterAll(async () => {
      await Promise.all([
        uno.from("goals").delete().eq("id", goalUno),
        dos.from("goals").delete().eq("id", goalDos),
        uno.from("time_blocks").delete().eq("id", blockUno),
      ]);
    });

    it("el trigger estampa el family_id sin que el cliente lo mande", async () => {
      // El insert de arriba no mandó family_id. Si la columna quedara en null
      // el insert habría fallado; que tenga el valor correcto es lo que prueba
      // que el trigger corre ANTES del NOT NULL.
      const { data } = await uno.from("goals").select("family_id").eq("id", goalUno).single();
      expect(data?.family_id).toBe(unoFamilyId);
    });

    it("goals: cada familia ve solo lo suyo", async () => {
      const [{ data: rowsUno }, { data: rowsDos }] = await Promise.all([
        uno.from("goals").select("family_id"),
        dos.from("goals").select("family_id"),
      ]);

      expect((rowsUno ?? []).length).toBeGreaterThan(0);
      expect((rowsDos ?? []).length).toBeGreaterThan(0);
      expect(new Set((rowsUno ?? []).map((r) => r.family_id))).toEqual(new Set([unoFamilyId]));
      expect(new Set((rowsDos ?? []).map((r) => r.family_id))).toEqual(new Set([dosFamilyId]));
    });

    it("time_blocks: cada familia ve solo lo suyo", async () => {
      const { data } = await dos.from("time_blocks").select("id").eq("id", blockUno);
      expect(data ?? []).toEqual([]);
    });

    it("un integrante SÍ ve los objetivos y los horarios de su casa", async () => {
      // Es el punto del módulo: si esto empieza a fallar, alguien les puso
      // is_parent() a las policies copiando las del expediente.
      const [{ data: goals }, { data: blocks }] = await Promise.all([
        hijo.from("goals").select("id"),
        hijo.from("time_blocks").select("id"),
      ]);

      expect((goals ?? []).map((g) => g.id)).toContain(goalUno);
      expect((blocks ?? []).map((b) => b.id)).toContain(blockUno);
    });

    it("un integrante puede tildar un paso que no es suyo", async () => {
      const { data: step } = await uno
        .from("goal_steps")
        .insert({ goal_id: goalUno, title: "Paso de prueba" })
        .select("id")
        .single();

      const { error } = await hijo
        .from("goal_steps")
        .update({ done_at: new Date().toISOString() })
        .eq("id", step!.id);

      expect(error).toBeNull();

      // Y el trigger firma quién lo hizo, sin que el cliente lo mande.
      const { data: after } = await hijo
        .from("goal_steps")
        .select("done_by_member_id")
        .eq("id", step!.id)
        .single();

      expect(after?.done_by_member_id).not.toBeNull();
      await uno.from("goal_steps").delete().eq("id", step!.id);
    });

    it("nadie escribe un objetivo en la familia ajena forzando el family_id", async () => {
      const { error } = await uno.from("goals").insert({
        family_id: dosFamilyId,
        title: "Esto no deberia existir",
      });

      expect(error).not.toBeNull();
    });

    it("no se puede borrar un objetivo de la otra familia", async () => {
      await uno.from("goals").delete().eq("id", goalDos);

      // El delete no da error —simplemente no afecta ninguna fila—, así que la
      // única forma de verificarlo es preguntarle al dueño si sigue ahí.
      const { data } = await dos.from("goals").select("id").eq("id", goalDos);
      expect(data).toHaveLength(1);
    });

    it("la base rechaza un bloque que cruza la medianoche", async () => {
      // El CHECK es lo que sostiene toda la aritmética de la vista diaria: si
      // se pudiera guardar un 22-06, los bloques empezarían "ayer".
      const { error } = await uno.from("time_blocks").insert({
        title: "Turno noche",
        starts_at: "22:00",
        ends_at: "06:00",
        weekdays: [1],
      });

      expect(error).not.toBeNull();
    });

    it("la base rechaza un bloque recurrente Y puntual a la vez", async () => {
      const { error } = await uno.from("time_blocks").insert({
        title: "Imposible",
        starts_at: "09:00",
        ends_at: "10:00",
        weekdays: [1],
        on_date: "2027-01-01",
      });

      expect(error).not.toBeNull();
    });
  });
});
