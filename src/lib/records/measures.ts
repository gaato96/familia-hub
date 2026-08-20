/**
 * Peso y talla, siempre en enteros de la unidad más chica.
 *
 * Mismo criterio que la plata en centavos: `3.4 kg` como float acumula error
 * al comparar y al graficar, y "3.4" no es lo mismo que "3.40" cuando después
 * hay que restar dos mediciones. Se guarda 3400 gramos y listo.
 */

export function parseWeightToGrams(input: string): number | null {
  const kg = parseDecimal(input);
  if (kg === null) return null;

  const grams = Math.round(kg * 1000);
  // Los CHECK de la base: entre 200 g y 300 kg. Se valida acá también para
  // dar un mensaje en castellano en vez de un error de Postgres.
  return grams >= 200 && grams <= 300_000 ? grams : null;
}

export function parseHeightToMm(input: string): number | null {
  const cm = parseDecimal(input);
  if (cm === null) return null;

  const mm = Math.round(cm * 10);
  return mm >= 200 && mm <= 2500 ? mm : null;
}

export function parseHeadCircToMm(input: string): number | null {
  const cm = parseDecimal(input);
  if (cm === null) return null;

  const mm = Math.round(cm * 10);
  return mm >= 200 && mm <= 700 ? mm : null;
}

export function formatWeight(grams: number | null): string {
  if (grams === null) return "—";
  // Un gramo de más o de menos no le importa a nadie; un decimal de kilo sí.
  return `${(grams / 1000).toFixed(grams % 1000 === 0 ? 0 : 3).replace(/0+$/, "").replace(/\.$/, "")} kg`;
}

export function formatHeight(mm: number | null): string {
  if (mm === null) return "—";
  return `${(mm / 10).toFixed(mm % 10 === 0 ? 0 : 1)} cm`;
}

/** Acepta "3,4" y "3.4": en Argentina se tipea con coma. */
function parseDecimal(input: string): number | null {
  const cleaned = input.trim().replace(",", ".");
  if (cleaned === "") return null;

  const value = Number(cleaned);
  return Number.isFinite(value) && value > 0 ? value : null;
}

/**
 * Edad en el formato que usa un pediatra: meses hasta los 2 años, después
 * años. "18 meses" dice mucho más que "1 año" cuando se trata de un bebé.
 */
export function ageLabel(birthDate: string | null, at: string): string | null {
  if (!birthDate) return null;

  const birth = new Date(`${birthDate}T00:00:00Z`);
  const when = new Date(`${at}T00:00:00Z`);
  if (when < birth) return null;

  const months =
    (when.getUTCFullYear() - birth.getUTCFullYear()) * 12 +
    (when.getUTCMonth() - birth.getUTCMonth()) -
    (when.getUTCDate() < birth.getUTCDate() ? 1 : 0);

  if (months < 1) {
    const days = Math.floor((when.getTime() - birth.getTime()) / 86_400_000);
    return `${days} ${days === 1 ? "día" : "días"}`;
  }
  if (months < 24) return `${months} ${months === 1 ? "mes" : "meses"}`;

  const years = Math.floor(months / 12);
  const rest = months % 12;
  return rest === 0
    ? `${years} años`
    : `${years} años y ${rest} ${rest === 1 ? "mes" : "meses"}`;
}
