import path from "node:path";

import dotenv from "dotenv";
import { defineConfig } from "vitest/config";

// Next.js guarda las variables de entorno locales en `.env.local`, no en
// `.env` (que es lo que Vitest/dotenv buscarían por defecto). Sin esto,
// tests/rls/* arranca sin URL ni claves de Supabase y falla sin explicar por
// qué.
dotenv.config({ path: path.resolve(import.meta.dirname, ".env.local") });

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "src") },
  },
});
