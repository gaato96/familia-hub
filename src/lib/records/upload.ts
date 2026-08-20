"use client";

import { createClient } from "@/lib/supabase/client";

/**
 * Subida de documentos al bucket privado.
 *
 * Sube directo del navegador a Supabase Storage, sin pasar por el server: las
 * policies del bucket ya exigen que el primer segmento de la ruta sea el
 * family_id del que sube Y que sea `parent`. Mandar el archivo al server para
 * que lo reenvíe duplicaría la transferencia sin agregar ninguna garantía.
 */

const BUCKET = "family-docs";

/** Tope del bucket. Se valida acá para avisar antes de subir 15 MB en vano. */
const MAX_BYTES = 15 * 1024 * 1024;

/**
 * Ancho máximo al que se reescala una foto antes de subirla.
 *
 * 2000px alcanza para leer la letra chica de un carnet de vacunas ampliando.
 * Una foto de celular sin tocar son 8-12 MP y 4 MB: veinte de esas se comen
 * la mitad del free tier de 1 GB sin que nadie note la diferencia al mirarlas.
 */
const MAX_DIMENSION = 2000;
const WEBP_QUALITY = 0.82;

export type UploadResult = {
  storagePath: string;
  mimeType: string;
  sizeBytes: number;
};

export async function uploadDocument({
  file,
  familyId,
  memberId,
}: {
  file: File;
  familyId: string;
  /** null = documento de la casa, no de una persona. */
  memberId: string | null;
}): Promise<UploadResult> {
  const prepared = await prepareFile(file);

  if (prepared.size > MAX_BYTES) {
    throw new Error("El archivo pesa más de 15 MB. Probá con una foto más chica.");
  }

  const extension = extensionFor(prepared.type);
  // Ruta: {family_id}/{member_id|_casa}/{uuid}.{ext}. El primer segmento es lo
  // único que compara la policy — ver 20260820130200_storage_documents.sql.
  const storagePath = `${familyId}/${memberId ?? "_casa"}/${crypto.randomUUID()}.${extension}`;

  const { error } = await createClient()
    .storage.from(BUCKET)
    .upload(storagePath, prepared, { contentType: prepared.type, upsert: false });

  if (error) throw new Error(mensajeDeSubida(error.message));

  return { storagePath, mimeType: prepared.type, sizeBytes: prepared.size };
}

/**
 * Borra el archivo del bucket. Se usa para deshacer una subida cuya fila de
 * `documents` falló: sin esto quedaría un huérfano ocupando espacio que nadie
 * puede ver ni borrar desde la app.
 */
export async function removeUploadedFile(storagePath: string): Promise<void> {
  await createClient().storage.from(BUCKET).remove([storagePath]);
}

/**
 * Comprime imágenes; los PDF pasan tal cual.
 *
 * Un PDF ya viene comprimido y recomprimirlo en el navegador lo rompería o lo
 * agrandaría. Las imágenes sí valen la pena: es donde está todo el peso.
 */
async function prepareFile(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;

  // HEIC (iPhone) no lo decodifica `createImageBitmap` en todos los
  // navegadores. Se sube tal cual antes que fallar la subida entera.
  if (file.type === "image/heic" || file.type === "image/heif") return file;

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));

    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) return file;
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", WEBP_QUALITY),
    );
    if (!blob) return file;

    // Si comprimir no ganó nada (una imagen ya chica y optimizada), se queda
    // con la original en vez de recodificarla y perder calidad para nada.
    if (blob.size >= file.size) return file;

    return new File([blob], `${file.name.replace(/\.[^.]+$/, "")}.webp`, {
      type: "image/webp",
    });
  } catch {
    // Cualquier problema decodificando: mejor subir el original que no subir.
    return file;
  }
}

function extensionFor(mimeType: string): string {
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/heic": "heic",
    "application/pdf": "pdf",
  };
  return map[mimeType] ?? "bin";
}

function mensajeDeSubida(raw: string): string {
  if (raw.includes("exceeded the maximum allowed size")) {
    return "El archivo pesa más de lo permitido.";
  }
  if (raw.includes("mime type") || raw.includes("not allowed")) {
    return "Ese tipo de archivo no se puede subir. Sacá una foto o subí un PDF.";
  }
  if (raw.toLowerCase().includes("row-level security")) {
    return "No tenés permiso para subir documentos.";
  }
  return "No se pudo subir el archivo. Probá de nuevo.";
}
