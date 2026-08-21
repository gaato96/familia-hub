import { expect, test, type Page } from "@playwright/test";

/**
 * El recorrido que la familia hace de verdad todos los días: entrar, pegar una
 * nota, tildar algo de la compra, mirar la semana.
 *
 * Es deliberadamente un solo test largo y no cuatro cortos: cada uno tendría
 * que volver a hacer login, y lo que se quiere verificar es justamente que la
 * sesión y la navegación entre secciones sobreviven al recorrido completo.
 *
 * Requiere `npm run db:seed`.
 */

/**
 * Los nombres de las secciones se repiten en el panel (la tarjeta "Objetivos"
 * también lleva a /objetivos), así que la navegación se busca SIEMPRE dentro
 * de la barra de pestañas. Sin esto, agregar una tarjeta al panel rompe un
 * test de navegación que no tiene nada que ver.
 */
const nav = (page: Page) => page.locator("nav.fixed");

const EMAIL = "uno.mama@test.local";
const PASSWORD = "familia-de-prueba-2026";

async function signIn(page: Page) {
  await page.goto("/ingresar");
  await page.getByLabel("Correo").fill(EMAIL);
  await page.getByLabel("Contraseña").fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  // El saludo cambia con la hora ("Buen día" / "Buenas tardes" / "Buenas
  // noches"), así que se ancla al nombre y no al saludo.
  await expect(page.getByRole("heading", { name: /Mamá/ })).toBeVisible();
}

test("la rutina de todos los días", async ({ page }) => {
  await signIn(page);

  // --- Pegar una nota en la heladera ------------------------------------
  const noteText = `Comprar pan ${Date.now()}`;

  await page.getByRole("button", { name: "Pegar una nota" }).first().click();
  await page.getByPlaceholder(/Comprar pan/).fill(noteText);
  await page.getByRole("button", { name: "Pegar en la heladera" }).click();

  await expect(page.getByText(noteText)).toBeVisible();

  // Sobrevive a un refresh: si solo estuviera en estado de React, esto falla.
  await page.reload();
  await expect(page.getByText(noteText)).toBeVisible();

  // --- Tildar algo en la compra -----------------------------------------
  await nav(page).getByRole("link", { name: "Compras" }).click();
  await expect(page.getByRole("heading", { name: "Compras" })).toBeVisible();

  // Se guarda el NOMBRE antes de tocarlo: al tildar, el ítem se va abajo a
  // "ya está" y `.first()` pasaría a apuntar a otra fila —que sigue sin
  // tildar— y el test fallaría por su propio efecto.
  const firstItem = page.getByRole("checkbox").first();
  const itemName = (await firstItem.textContent())!.trim();
  await firstItem.click();
  await expect(page.getByRole("checkbox", { name: itemName })).toBeChecked();

  await page.reload();
  await expect(page.getByText(/Ya está \(/)).toBeVisible();

  // --- Mirar la semana ---------------------------------------------------
  await nav(page).getByRole("link", { name: "Semana" }).click();
  await expect(page.getByText(/· hoy/)).toBeVisible();

  // Navegar a la semana siguiente cambia la URL, así que el link se puede
  // compartir y el botón "atrás" del teléfono vuelve a la semana anterior.
  await page.getByRole("link", { name: "Semana siguiente" }).click();
  await expect(page).toHaveURL(/semana=\d{4}-\d{2}-\d{2}/);
  await expect(page.getByText(/· hoy/)).toHaveCount(0);

  await page.goBack();
  await expect(page.getByText(/· hoy/)).toBeVisible();
});

test("una tarea recurrente aparece en el planner después de crearla", async ({ page }) => {
  await signIn(page);

  await nav(page).getByRole("link", { name: "Semana" }).click();
  await page.getByRole("button", { name: "Agregar" }).click();

  const title = `Regar las plantas ${Date.now()}`;
  await page.getByLabel("¿Qué hay que hacer?").fill(title);
  await page.getByRole("button", { name: "Cada N días" }).click();
  await page.getByRole("button", { name: "Crear tarea" }).click();

  // La ocurrencia se materializa del lado del servidor: si el planner mostrara
  // la tarea sin que exista la fila, no se podría tildar.
  await expect(page.getByText(title).first()).toBeVisible();
});

test("el día se arma con bloques y la vista lo dibuja", async ({ page }) => {
  await signIn(page);

  await nav(page).getByRole("link", { name: "Hoy" }).click();
  await expect(page).toHaveURL(/\/dia/);

  const title = `Clase de natación ${Date.now()}`;

  await page.getByRole("button", { name: /Agregar un bloque|Bloque/ }).first().click();
  await page.getByLabel("Qué es").fill(title);
  await page.getByLabel("Desde").fill("17:00");
  await page.getByLabel("Hasta").fill("18:30");
  await page.getByRole("button", { name: "Agregar bloque" }).click();

  await expect(page.getByText(title).first()).toBeVisible();

  // El bloque tiene que sobrevivir al refresh: si solo estuviera en estado de
  // React, la línea de tiempo se vaciaría.
  await page.reload();
  await expect(page.getByText(title).first()).toBeVisible();

  // Y aparece también en la vista semanal, que lee los mismos bloques.
  await nav(page).getByRole("link", { name: "Semana" }).click();
  await expect(page.getByTitle(title).first()).toBeVisible();
});

test("sin sesión, cualquier pantalla privada manda a ingresar", async ({ page }) => {
  await page.context().clearCookies();

  await page.goto("/compras");
  await expect(page).toHaveURL(/\/ingresar/);
  // Y vuelve a donde quería ir después de entrar.
  await expect(page).toHaveURL(/next=%2Fcompras/);
});
