import { defineConfig, devices } from "@playwright/test";

/**
 * E2E contra el proyecto REAL de Supabase (no hay Docker en esta máquina),
 * igual que la suite de RLS. Requiere `npm run db:seed` antes.
 *
 * Un solo proyecto y en viewport de teléfono: la app es mobile-first y no
 * existe un caso de uso de escritorio que valga la pena cubrir. Probar en
 * desktop daría verde sobre layouts que nadie va a ver.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
    locale: "es-AR",
    timezoneId: "America/Argentina/Buenos_Aires",
  },
  projects: [{ name: "phone", use: { ...devices["Pixel 7"] } }],
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: "npm run dev",
        url: "http://localhost:3000/ingresar",
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
