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
  if (existing) await admin.auth.admin.deleteUser(existing.id);

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: SEED_PASSWORD,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`No se pudo crear ${email}: ${error?.message}`);

  return data.user.id;
}

async function seedFamilyContent(
  client: Awaited<ReturnType<typeof signedInClient>>,
  label: string,
) {
  const { data: members } = await client.from("family_members").select("id, kind");
  const memberIds = (members ?? []).map((m) => m.id);

  await client.from("notes").insert([
    { body: `Nota de ${label}`, color: "yellow" },
    { body: `Otra nota de ${label}`, color: "blue", is_pinned: true },
  ]);

  const { data: task } = await client
    .from("tasks")
    .insert({
      title: `Limpiar el baño (${label})`,
      category: "limpieza",
      recurrence: { freq: "weekly", byweekday: [6] },
      rotation_member_ids: memberIds,
    })
    .select("id")
    .single();

  if (task) {
    await client.from("task_steps").insert([
      { task_id: task.id, label: "Pasar el trapo con vinagre", kind: "do", position: 0 },
      { task_id: task.id, label: "No usar lavandina en las juntas", kind: "dont", position: 1 },
    ]);
  }

  await client.from("events").insert({
    title: `Pediatra (${label})`,
    starts_at: new Date(Date.now() + 86_400_000).toISOString(),
    category: "salud",
  });

  const { data: lists } = await client.from("shopping_lists").select("id, kind");
  const superList = lists?.find((l) => l.kind === "supermercado");
  if (superList) {
    await client.from("shopping_items").insert([
      { list_id: superList.id, name: `Leche (${label})`, is_frequent: true },
      { list_id: superList.id, name: `Pan (${label})` },
    ]);
  }

  await client.rpc("ensure_task_instances", {
    p_until: new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10),
  });
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
