/**
 * La plata es SIEMPRE centavos enteros. Nunca float.
 *
 * Un alquiler de $450.000 son 45_000_000 centavos. El `integer` de Postgres
 * llega hasta $21.474.836, de sobra para un gasto suelto; los acumulados del
 * módulo de Finanzas se suman como `bigint` del lado de la base.
 *
 * Único lugar con lógica de formato y parseo de plata en toda la app.
 */

export const CENTS = 100;

export function formatMoney(
  cents: number,
  { currency = "ARS", locale = "es-AR" }: { currency?: string; locale?: string } = {},
) {
  const amount = cents / CENTS;

  // Los precios de una casa se hablan en pesos enteros. Mostrar "$45.000,00"
  // en cada fila es ruido, así que los decimales aparecen solo cuando dicen algo.
  const hasFraction = cents % CENTS !== 0;

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: hasFraction ? 2 : 0,
  }).format(amount);
}

/** Parsea lo que alguien tipea en un campo de precio: "15.400", "15400,50", "$ 15400". */
export function parseMoneyToCents(input: string): number | null {
  const cleaned = input
    .replace(/[^\d.,-]/g, "")
    .replace(/\.(?=\d{3}\b)/g, "") // separador de miles
    .replace(",", ".");

  if (cleaned === "" || cleaned === "-") return null;

  const value = Number(cleaned);
  if (!Number.isFinite(value) || value < 0) return null;

  return Math.round(value * CENTS);
}

export function sumCents(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

/**
 * Reparte `totalCents` según pesos en basis points (10000 = 100%), sin perder
 * ni un centavo por redondeo.
 *
 * El resto de la división se entrega de a un centavo a las partes con mayor
 * resto fraccionario (método del mayor resto). Sin esto, seis rubros con
 * porcentajes redondos casi siempre suman uno o dos centavos menos que el
 * ingreso total, y el módulo de Finanzas muestra una diferencia que nadie
 * puede explicar.
 */
export function splitByBasisPoints(totalCents: number, weightsBp: number[]): number[] {
  const totalBp = weightsBp.reduce((a, b) => a + b, 0);
  if (totalBp <= 0) return weightsBp.map(() => 0);

  const exact = weightsBp.map((bp) => (totalCents * bp) / totalBp);
  const floored = exact.map(Math.floor);
  let remainder = totalCents - floored.reduce((a, b) => a + b, 0);

  const order = exact
    .map((value, index) => ({ index, frac: value - Math.floor(value) }))
    .sort((a, b) => b.frac - a.frac);

  for (const { index } of order) {
    if (remainder <= 0) break;
    floored[index] += 1;
    remainder -= 1;
  }

  return floored;
}
