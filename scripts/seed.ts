import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

// Mismo motivo que en db-push.ts: sin el `path` explícito, dotenv busca
// `.env` y no encuentra las variables que en verdad viven en `.env.local`.
dotenv.config({ path: ".env.local" });

import type { Database } from "../src/types/database";

/**
 * Siembra DOS familias de prueba.
 *
 * Dos y no una: el test que más importa del proyecto es que una familia no vea
 * ni una fila de la otra, y eso no se puede probar con un solo tenant. Cada
 * familia se llena con datos en todas las tablas para que el barrido de
 * tests/rls/isolation.test.ts tenga algo que NO encontrar.
 *
 * PELIGRO: borra los usuarios de prueba y sus familias en cascada. No correrlo
 * contra un proyecto con los datos reales de la casa.
 */

const SUPABASE_URL = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
const ANON_KEY = requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
const SERVICE_KEY = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

export const SEED_PASSWORD = "familia-de-prueba-2026";

export const SEED_USERS = {
  unoParent: "uno.mama@test.local",
  unoChild: "uno.hijo@test.local",
  dosParent: "dos.papa@test.local",
} as const;

const admin = createClient<Database>(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Falta ${name} en .env.local`);
  return value;
}

/** Cliente con sesión propia por usuario: las RPC de alta dependen de auth.uid(). */
async function signedInClient(email: string) {
  const client = createClient<Database>(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await client.auth.signInWithPassword({
    email,
    password: SEED_PASSWORD,
  });
  if (error) throw new Error(`No se pudo entrar como ${email}: ${error.message}`);
  return client;
}

async function recreateUser(email: string): Promise<string> {
  const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const existing = list?.users.find((u) => u.email === email);

  // Borrar el usuario arrastra en cascada su profile y, con él, la familia
  // entera: es lo que hace repetible correr el seed dos veces seguidas.
  //
  // El error se chequea: ignorarlo fue lo que escondió que borrar una cuenta
  // rompía la base entera (ver 20260820140000). El síntoma era un seed que
  // decía "Listo" con la mitad de las tablas vacías.
  if (existing) {
    const { error: deleteError } = await admin.auth.admin.deleteUser(existing.id);
    if (deleteError) {
      throw new Error(`No se pudo borrar ${email}: ${deleteError.message}`);
    }
  }

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: SEED_PASSWORD,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`No se pudo crear ${email}: ${error?.message}`);

  return data.user.id;
}

/**
 * Cualquier error del seed corta el script.
 *
 * La versión anterior ignoraba los `error` de cada insert, y el resultado fue
 * un seed que decía "Listo" con media base vacía: los tests de RLS fallaban
 * por falta de datos y parecía un problema de policies. Un seed silencioso
 * miente en el peor momento posible.
 */
function check(step: string, error: { message: string } | null) {
  if (error) throw new Error(`${step}: ${error.message}`);
}

async function seedFamilyContent(
  client: Awaited<ReturnType<typeof signedInClient>>,
  label: string,
) {
  const { data: members, error: membersError } = await client
    .from("family_members")
    .select("id, kind");
  check(`${label} leer integrantes`, membersError);
  const memberIds = (members ?? []).map((m) => m.id);

  // OJO con los inserts de varias filas: PostgREST arma UN solo INSERT con la
  // unión de las claves de todos los objetos, y para la fila a la que le falta
  // una clave manda NULL explícito en vez de dejar que actúe el DEFAULT. Con
  // `is_pinned NOT NULL DEFAULT false`, omitirlo en una sola de las dos filas
  // hace fallar el lote entero. Todas las filas de un mismo insert tienen que
  // llevar exactamente las mismas claves.
  check(
    `${label} notas`,
    (
      await client.from("notes").insert([
        { body: `Nota de ${label}`, color: "yellow", is_pinned: false },
        { body: `Otra nota de ${label}`, color: "blue", is_pinned: true },
      ])
    ).error,
  );

  const { data: task, error: taskError } = await client
    .from("tasks")
    .insert({
      title: `Limpiar el baño (${label})`,
      category: "limpieza",
      recurrence: { freq: "weekly", byweekday: [6] },
      rotation_member_ids: memberIds,
    })
    .select("id")
    .single();
  check(`${label} tarea`, taskError);

  if (task) {
    check(
      `${label} pasos`,
      (
        await client.from("task_steps").insert([
          { task_id: task.id, label: "Pasar el trapo con vinagre", kind: "do", position: 0 },
          { task_id: task.id, label: "No usar lavandina en las juntas", kind: "dont", position: 1 },
        ])
      ).error,
    );
  }

  check(
    `${label} evento`,
    (
      await client.from("events").insert({
        title: `Pediatra (${label})`,
        starts_at: new Date(Date.now() + 86_400_000).toISOString(),
        category: "salud",
      })
    ).error,
  );

  const { data: lists, error: listsError } = await client
    .from("shopping_lists")
    .select("id, kind");
  check(`${label} leer listas`, listsError);

  const superList = lists?.find((l) => l.kind === "supermercado");
  if (!superList) throw new Error(`${label}: no se sembraron las listas por defecto`);

  check(
    `${label} compras`,
    (
      // Mismas claves en las dos filas — ver el comentario sobre los inserts
      // múltiples más arriba.
      await client.from("shopping_items").insert([
        { list_id: superList.id, name: `Leche (${label})`, is_frequent: true },
        { list_id: superList.id, name: `Pan (${label})`, is_frequent: false },
      ])
    ).error,
  );

  // --- Expediente (Fase 2) -----------------------------------------------
  // Los tests de RLS necesitan que estas tablas tengan filas para poder
  // verificar que un `child` NO las ve. Sin datos, ese test pasa en verde
  // contra una base vacía.
  const dependent = (members ?? []).find((m) => m.kind === "dependent");
  const target = dependent?.id ?? memberIds[0];

  if (target) {
    check(
      `${label} datos personales`,
      (
        await client.from("member_details").upsert(
          {
            member_id: target,
            blood_type: "O+",
            allergies: `Polen (${label})`,
            health_insurance: "OSDE",
          },
          { onConflict: "member_id" },
        )
      ).error,
    );

    check(
      `${label} medicamento`,
      (
        await client.from("medications").insert({
          member_id: target,
          name: `Ibuprofeno (${label})`,
          dose: "5 ml",
          treats: "Fiebre",
        })
      ).error,
    );

    check(
      `${label} vacuna`,
      (
        await client.from("vaccines").insert({
          member_id: target,
          name: `Triple viral (${label})`,
          applied_on: "2026-01-15",
        })
      ).error,
    );

    check(
      `${label} consulta`,
      (
        await client.from("medical_visits").insert({
          member_id: target,
          visited_on: "2026-02-10",
          specialty: "Pediatría",
        })
      ).error,
    );

    check(
      `${label} medición`,
      (
        await client.from("growth_records").insert({
          member_id: target,
          measured_on: "2026-02-10",
          weight_grams: 12_400,
          height_mm: 870,
        })
      ).error,
    );

    check(
      `${label} hito`,
      (
        await client.from("milestones").insert({
          member_id: target,
          title: `Primeros pasos (${label})`,
          achieved_on: "2026-01-20",
        })
      ).error,
    );

    check(
      `${label} talle`,
      (
        await client.from("member_sizes").insert({
          member_id: target,
          kind: "calzado",
          value: "26",
        })
      ).error,
    );
  }

  check(
    `${label} contacto`,
    (
      await client.from("contacts").insert({
        name: `Dra. Pérez (${label})`,
        role: "Pediatra",
        phone: "11 5555 5555",
        category: "salud",
        is_emergency: true,
      })
    ).error,
  );

  // --- Finanzas (Fase 3) --------------------------------------------------
  const today = new Date().toISOString().slice(0, 10);
  const month = `${today.slice(0, 7)}-01`;

  check(
    `${label} ingreso`,
    (
      await client.from("income_entries").insert({
        label: `Sueldo (${label})`,
        amount_cents: 1_200_000_00,
        period_month: month,
        member_id: memberIds[0] ?? null,
      })
    ).error,
  );

  const { data: allocs, error: allocsError } = await client
    .from("budget_allocations")
    .select("id, label");
  check(`${label} leer rubros`, allocsError);

  check(
    `${label} gasto`,
    (
      await client.from("expenses").insert({
        label: `Alquiler (${label})`,
        amount_cents: 450_000_00,
        due_date: `${month.slice(0, 8)}10`,
        category: "alquiler",
        allocation_id: allocs?.[0]?.id ?? null,
        is_recurring: true,
      })
    ).error,
  );

  // --- Comidas y despensa (Fase 4) ----------------------------------------
  const { data: recipe, error: recipeError } = await client
    .from("recipes")
    .insert({
      title: `Milanesas con puré (${label})`,
      minutes: 45,
      servings: 4,
    })
    .select("id")
    .single();
  check(`${label} receta`, recipeError);

  check(
    `${label} despensa`,
    (
      await client.from("pantry_items").insert([
        {
          name: "Papas",
          quantity: 1,
          unit: "kg",
          location: "despensa",
          min_quantity: 2,
          expires_on: null,
        },
        {
          name: "Leche",
          quantity: 0,
          unit: "litros",
          location: "heladera",
          min_quantity: 1,
          expires_on: null,
        },
      ])
    ).error,
  );

  if (recipe) {
    const { data: pantry } = await client
      .from("pantry_items")
      .select("id, name")
      .eq("name", "Papas")
      .maybeSingle();

    check(
      `${label} ingredientes`,
      (
        await client.from("recipe_ingredients").insert([
          // "Papas" va vinculada a la despensa: la generación de la lista tiene
          // que descontar el kilo que ya hay y pedir solo lo que falta.
          {
            recipe_id: recipe.id,
            name: "Papas",
            quantity: 3,
            unit: "kg",
            pantry_item_id: pantry?.id ?? null,
            position: 0,
          },
          {
            recipe_id: recipe.id,
            name: "Carne",
            quantity: 1,
            unit: "kg",
            pantry_item_id: null,
            position: 1,
          },
        ])
      ).error,
    );

    check(
      `${label} menú`,
      (
        await client.from("meal_plan").insert({
          meal_date: today,
          slot: "cena",
          recipe_id: recipe.id,
        })
      ).error,
    );
  }

  // --- Fase 5: objetivos y bloques ------------------------------------------
  const { data: goal, error: goalError } = await client
    .from("goals")
    .insert({
      title: `Ordenar el garage (${label})`,
      category: "casa",
      detail: "Que se pueda entrar el auto antes del verano.",
    })
    .select("id")
    .single();
  check(`${label} objetivo`, goalError);

  if (goal) {
    check(
      `${label} pasos del objetivo`,
      (
        await client.from("goal_steps").insert([
          {
            goal_id: goal.id,
            title: "Sacar las cajas del fondo",
            assigned_member_id: memberIds[0] ?? null,
            position: 0,
          },
          {
            goal_id: goal.id,
            title: "Llamar al de las estanterías",
            assigned_member_id: memberIds[1] ?? memberIds[0] ?? null,
            position: 1,
          },
        ])
      ).error,
    );
  }

  // Un bloque de una persona y uno de toda la casa: alcanza para que la vista
  // diaria muestre las dos formas —y para que se vea el solapamiento, que es
  // lo único de la línea de tiempo que se rompe en silencio.
  check(
    `${label} bloques de horarios`,
    (
      await client.from("time_blocks").insert([
        {
          title: "Trabajo",
          kind: "trabajo",
          member_id: memberIds[0] ?? null,
          starts_at: "09:00",
          ends_at: "18:00",
          weekdays: [1, 2, 3, 4, 5],
          on_date: null,
        },
        {
          title: "Almuerzo",
          kind: "comida",
          member_id: null,
          starts_at: "13:00",
          ends_at: "14:00",
          weekdays: [1, 2, 3, 4, 5, 6, 7],
          on_date: null,
        },
      ])
    ).error,
  );

  check(
    `${label} generar ocurrencias`,
    (
      await client.rpc("ensure_task_instances", {
        p_until: new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10),
      })
    ).error,
  );
}

async function main() {
  console.log("Recreando usuarios de prueba...");
  await recreateUser(SEED_USERS.unoParent);
  await recreateUser(SEED_USERS.unoChild);
  await recreateUser(SEED_USERS.dosParent);

  // --- Familia Uno -----------------------------------------------------
  const uno = await signedInClient(SEED_USERS.unoParent);
  await uno.rpc("create_family", { p_family_name: "Familia Uno", p_display_name: "Mamá Uno" });
  await uno.auth.refreshSession(); // los claims se estampan al emitir el token

  await uno.from("family_members").insert({
    kind: "dependent",
    display_name: "Julián",
    color: "#0EA5E9",
    position: 1,
  });

  const { data: unoFamily } = await uno.from("families").select("invite_code").single();
  if (!unoFamily) throw new Error("No se pudo leer la familia Uno");

  const unoHijo = await signedInClient(SEED_USERS.unoChild);
  await unoHijo.rpc("join_family", {
    p_invite_code: unoFamily.invite_code,
    p_display_name: "Hijo Uno",
  });
  await unoHijo.auth.refreshSession();

  await seedFamilyContent(uno, "Uno");

  // --- Familia Dos -----------------------------------------------------
  const dos = await signedInClient(SEED_USERS.dosParent);
  await dos.rpc("create_family", { p_family_name: "Familia Dos", p_display_name: "Papá Dos" });
  await dos.auth.refreshSession();
  await seedFamilyContent(dos, "Dos");

  console.log("\nListo.");
  console.log(`  ${SEED_USERS.unoParent}  (adulto, Familia Uno)`);
  console.log(`  ${SEED_USERS.unoChild}   (integrante, Familia Uno)`);
  console.log(`  ${SEED_USERS.dosParent}  (adulto, Familia Dos)`);
  console.log(`  contraseña: ${SEED_PASSWORD}`);
  console.log(`  código de invitación de Familia Uno: ${unoFamily.invite_code}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
