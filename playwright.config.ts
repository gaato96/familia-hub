import { defineConfig, devices } from "@playwright/test";

/**
 * E2E contra el proyecto REAL de Supabase (no hay Docker en esta máquina),
 * igual que la suite de RLS. Requiere `npm run db:seed` antes.
 *
 * Un solo proyecto, en viewport de teléfono. El escritorio no es otro proyecto
 * sino un archivo aparte (`escritorio.spec.ts`) que fija su propio viewport:
 * correr TODO el recorrido dos veces costaría el doble para volver a probar la
 * misma lógica, y lo único que cambia de verdad al agrandar la ventana es el
 * shell — qué navegación se muestra y qué forma toman los formularios.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: "list",
  /**
   * Timeouts holgados a propósito.
   *
   * La suite corre contra `next dev`, que compila cada ruta la PRIMERA vez que
   * alguien la pide: el primer click sobre "Hoy" o sobre "Semana" en una tanda
   * limpia puede tardar diez segundos en pintar. Con los 5s por defecto, el
   * test que le toca ir primero falla por lento y no por roto — y peor, falla
   * uno distinto cada vez, que es la clase de test que la gente termina
   * ignorando.
   */
  expect: { timeout: 20_000 },
  use: {
    actionTimeout: 20_000,
    navigationTimeout: 30_000,
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
