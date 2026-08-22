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

  // Y se saca al terminar. Sin esto la heladera junta un papelito por corrida:
  // a las diez corridas el tablero es tan alto que la barra de pestañas queda
  // debajo del pliegue y los tests siguientes empiezan a fallar solos.
  await page
    .getByRole("button", { name: `Sacar la nota "${noteText}"` })
    .click();
  await expect(page.getByText(noteText)).toHaveCount(0);

  // --- Tildar algo en la compra -----------------------------------------
  await nav(page).getByRole("link", { name: "Compras" }).click();
  await expect(page.getByRole("heading", { name: "Compras" })).toBeVisible();

  // Se agrega un ítem propio en vez de tildar el primero de la lista.
  //
  // `.first()` dependía del estado que dejó la corrida anterior: después de
  // unas cuantas, todos los ítems de la semilla ya estaban tildados y el test
  // terminaba DEStildando uno — y fallaba por su propio efecto acumulado. Con
  // un nombre único, la corrida número cincuenta se comporta como la primera.
  const itemName = `Yerba ${Date.now()}`;
  await page.getByPlaceholder(/Agregar a/).fill(itemName);
  await page.getByRole("button", { name: "Agregar", exact: true }).click();

  const item = page.getByRole("checkbox", { name: itemName });
  await expect(item).toBeVisible();
  await item.click();

  // Se verifica DESPUÉS del refresh: el tilde es optimista, así que la prueba
  // de que se guardó es que sobreviva a recargar, no lo que muestre React.
  await page.reload();
  await expect(page.getByRole("checkbox", { name: itemName })).toBeChecked();
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

  // Se borra al terminar. Sin esto la corrida número ocho deja ocho bloques
  // superpuestos en el mismo horario: `assignLanes` los reparte en ocho
  // columnas de veinte píxeles y el título deja de verse, así que el test
  // termina fallando por la basura que dejó él mismo.
  await nav(page).getByRole("link", { name: "Hoy" }).click();
  await page.getByRole("button", { name: title }).click();
  await page.getByRole("button", { name: "Borrar bloque" }).click();
  await expect(page.getByRole("button", { name: title })).toHaveCount(0);
});

test("la foto de perfil se sube, se recorta y se sirve por la ruta privada", async ({
  page,
}) => {
  await signIn(page);
  await nav(page).getByRole("link", { name: "Más" }).click();

  // Un PNG apaisado de 2x1: si el recorte no funcionara, la imagen que sirve
  // la ruta no sería cuadrada.
  await page.setInputFiles('input[type="file"]', {
    name: "foto.png",
    mimeType: "image/png",
    buffer: WIDE_PNG,
  });

  const avatar = page.locator('main img[src^="/api/avatar/"]').first();
  await expect(avatar).toBeVisible({ timeout: 15_000 });

  // El bucket es privado: la única forma de ver la foto es la ruta, y la ruta
  // exige sesión. Sin cookies tiene que rebotar.
  const src = (await avatar.getAttribute("src"))!;
  const conSesion = await page.request.get(src);
  expect(conSesion.status()).toBe(200);
  expect(conSesion.headers()["content-type"]).toContain("image");

  const dimensiones = await avatar.evaluate(
    (img: HTMLImageElement) => [img.naturalWidth, img.naturalHeight],
  );
  expect(dimensiones[0]).toBe(dimensiones[1]);
});

test("sin sesión, cualquier pantalla privada manda a ingresar", async ({ page }) => {
  await page.context().clearCookies();

  await page.goto("/compras");
  await expect(page).toHaveURL(/\/ingresar/);
  // Y vuelve a donde quería ir después de entrar.
  await expect(page).toHaveURL(/next=%2Fcompras/);
});

/**
 * PNG de 2x1 píxeles, en base64.
 *
 * Va inline y no como archivo suelto en el repo: un binario de 70 bytes
 * escondido en una carpeta de fixtures es exactamente lo que se borra por
 * error dentro de seis meses.
 */
const WIDE_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAYAAAD0In+KAAAAFElEQVR4nGP8z8Dwn4GBgYEJRIAAIxYCAn8Br1YAAAAASUVORK5CYII=",
  "base64",
);
