import { expect, test, type Page } from "@playwright/test";

/**
 * El shell de escritorio.
 *
 * Corto a propósito: no repite el recorrido de `rutina-diaria.spec.ts` —eso
 * sería pagar dos veces el mismo test— sino que verifica lo único que cambia
 * de verdad al pasar de 390px a 1440px: qué navegación se muestra, y que los
 * formularios dejen de ser una hoja pegada abajo.
 *
 * Requiere `npm run db:seed`.
 */

test.use({ viewport: { width: 1440, height: 900 } });

const EMAIL = "uno.mama@test.local";
const PASSWORD = "familia-de-prueba-2026";

async function signIn(page: Page) {
  await page.goto("/ingresar");
  await page.getByLabel("Correo").fill(EMAIL);
  await page.getByLabel("Contraseña").fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("heading", { name: /Mamá/ })).toBeVisible();
}

test("en escritorio manda la barra lateral y no las pestañas de abajo", async ({ page }) => {
  await signIn(page);

  const sidebar = page.locator("aside");
  await expect(sidebar).toBeVisible();

  // Los destinos que en el teléfono viven escondidos en "Más" acá están a la
  // vista: es toda la ventaja de tener lugar.
  await expect(sidebar.getByRole("link", { name: "Objetivos" })).toBeVisible();
  await expect(sidebar.getByRole("link", { name: "Finanzas" })).toBeVisible();

  // Y la barra de pestañas del teléfono no se dibuja dos veces.
  await expect(page.locator("nav.fixed")).toBeHidden();
});

test("el formulario es un diálogo centrado, no una hoja pegada abajo", async ({ page }) => {
  await signIn(page);

  // Dentro de la barra lateral: el panel también tiene una tarjeta que
  // lleva a /objetivos.
  await page.locator("aside").getByRole("link", { name: "Objetivos" }).click();
  await page.getByRole("button", { name: "Nuevo objetivo" }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();

  const box = await dialog.boundingBox();
  const viewport = page.viewportSize()!;

  // La prueba de que es un diálogo y no una hoja: no toca el borde inferior de
  // la ventana. En un monitor de 27", una hoja abajo del todo deja media
  // pantalla vacía arriba y obliga a mirar donde no está el mouse.
  expect(box!.y + box!.height).toBeLessThan(viewport.height - 20);
  expect(box!.width).toBeLessThan(viewport.width / 2);
});
