"use client";

import { createClient } from "@/lib/supabase/client";

/**
 * Foto de perfil de un integrante.
 *
 * El bucket `avatars` es privado igual que el de documentos —ver
 * 20260820121000_storage_avatars.sql sobre por qué hay un solo patrón— así que
 * la foto no se muestra por URL pública sino a través de `/api/avatar/[id]`.
 *
 * A diferencia de un documento, acá la imagen se recorta a un CUADRADO antes
 * de subir. En la app se muestra siempre dentro de un círculo: si se subiera
 * la foto entera, el círculo recortaría por el centro y una foto apaisada
 * quedaría con media cara afuera. Recortando al subir, lo que se ve es lo
 * mismo en todos lados.
 */

const BUCKET = "avatars";

/**
 * 512px de lado. Es cuatro veces el avatar más grande que dibuja la app (128px
 * en el expediente) — alcanza para pantallas retina y deja archivos de ~40 KB.
 * El bucket tope es de 2 MB, así que nunca se llega ni cerca.
 */
const SIZE = 512;
const WEBP_QUALITY = 0.85;

/**
 * Sube la foto y la deja apuntada en `family_members.avatar_path`.
 *
 * Devuelve la ruta nueva. Si la fila no se puede actualizar, borra el archivo
 * recién subido: al revés quedaría un huérfano ocupando espacio que nadie
 * puede ver ni eliminar desde la app — el mismo criterio que en `documents`.
 */
export async function uploadAvatar({
  file,
  familyId,
  memberId,
  previousPath,
}: {
  file: File;
  familyId: string;
  memberId: string;
  /** La foto anterior, para borrarla recién cuando la nueva quedó guardada. */
  previousPath: string | null;
}): Promise<string> {
  const prepared = await toSquareWebp(file);

  // Ruta: {family_id}/{member_id}/{uuid}.webp. El primer segmento es lo único
  // que compara la policy del bucket.
  const storagePath = `${familyId}/${memberId}/${crypto.randomUUID()}.webp`;
  const supabase = createClient();

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, prepared, { contentType: prepared.type, upsert: false });

  if (uploadError) throw new Error(uploadMessage(uploadError.message));

  const { error: rowError } = await supabase
    .from("family_members")
    .update({ avatar_path: storagePath })
    .eq("id", memberId);

  if (rowError) {
    await supabase.storage.from(BUCKET).remove([storagePath]);
    throw new Error("No se pudo guardar la foto. Probá de nuevo.");
  }

  // El archivo viejo se borra AL FINAL. Si se borrara primero y la subida
  // fallara, el integrante se quedaría sin foto por un error que no era suyo.
  if (previousPath) await supabase.storage.from(BUCKET).remove([previousPath]);

  return storagePath;
}

export async function removeAvatar({
  memberId,
  path,
}: {
  memberId: string;
  path: string;
}): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase
    .from("family_members")
    .update({ avatar_path: null })
    .eq("id", memberId);

  if (error) throw new Error("No se pudo sacar la foto.");

  await supabase.storage.from(BUCKET).remove([path]);
}

/**
 * Recorta al cuadrado del centro y reescala a 512px, en WebP.
 *
 * Recorta al centro y no achata la imagen: una foto estirada para entrar en un
 * cuadrado deforma la cara, que es exactamente lo único que hay en un avatar.
 */
async function toSquareWebp(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);

  const side = Math.min(bitmap.width, bitmap.height);
  const sx = (bitmap.width - side) / 2;
  const sy = (bitmap.height - side) / 2;

  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;

  const context = canvas.getContext("2d");
  if (!context) throw new Error("Este navegador no puede procesar la imagen.");

  context.drawImage(bitmap, sx, sy, side, side, 0, 0, SIZE, SIZE);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/webp", WEBP_QUALITY),
  );
  if (!blob) throw new Error("No se pudo procesar la imagen.");

  return new File([blob], "avatar.webp", { type: "image/webp" });
}

function uploadMessage(raw: string): string {
  if (raw.includes("exceeded the maximum allowed size")) {
    return "La foto pesa demasiado. Probá con otra.";
  }
  if (raw.toLowerCase().includes("row-level security")) {
    return "No tenés permiso para cambiar esta foto.";
  }
  return "No se pudo subir la foto. Probá de nuevo.";
}
