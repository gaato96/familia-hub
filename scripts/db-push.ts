import { spawnSync } from "node:child_process";

import dotenv from "dotenv";

// `dotenv/config` por defecto busca un archivo llamado `.env`. Next.js usa
// `.env.local` para las variables que no se commitean, así que hay que
// apuntarle explícitamente o esto falla en silencio creyendo que no hay nada.
dotenv.config({ path: ".env.local" });

/**
 * Aplica las migraciones al proyecto hosteado.
 *
 * No hay Docker en esta máquina, así que `supabase start` y `supabase db reset`
 * no corren: se empuja directo contra el proyecto real. Este wrapper existe
 * para no tener que pegar la contraseña de la base en la terminal cada vez —
 * y para que no quede en el historial de la shell.
 *
 * Regla que no se negocia: NUNCA editar una migración ya aplicada. Se escribe
 * una nueva. La base del proyecto real no se puede "resetear y volver a
 * correr" sin perder los datos de la familia.
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const password = process.env.SUPABASE_DB_PASSWORD;

if (!url || !password) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_DB_PASSWORD en .env.local");
  process.exit(1);
}

const projectRef = new URL(url).hostname.split(".")[0];
const dbUrl = `postgresql://postgres:${encodeURIComponent(password)}@db.${projectRef}.supabase.co:5432/postgres`;

console.log(`Aplicando migraciones a ${projectRef}...`);

const result = spawnSync(
  "npx",
  ["supabase", "db", "push", "--db-url", dbUrl],
  { stdio: "inherit", shell: process.platform === "win32" },
);

if (result.status !== 0) process.exit(result.status ?? 1);

console.log("\nRecordatorio: si esta tanda tocó custom_access_token_hook, revisá que el");
console.log("hook siga habilitado en Dashboard -> Authentication -> Hooks.");
