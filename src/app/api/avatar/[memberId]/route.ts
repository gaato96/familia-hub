import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

/**
 * Sirve la foto de perfil de un integrante.
 *
 * El bucket es privado, así que la foto no tiene URL pública. La alternativa
 * era firmar una URL por cada avatar y pasarla por props hasta `MemberAvatar`
 * — que se usa en quince pantallas, algunas de servidor y otras de cliente,
 * todas tipadas contra `FamilyMemberRow`. Habría significado tocar quince
 * archivos para agregar un campo que no está en la tabla.
 *
 * Con esta ruta, `<img src="/api/avatar/{id}">` funciona en cualquier lado sin
 * plomería y sin que la URL firmada aparezca nunca en el HTML.
 *
 * El aislamiento lo sigue haciendo RLS: la lectura de `family_members` de
 * abajo usa la sesión de quien pide, así que el id de un integrante de otra
 * casa no devuelve fila y la respuesta es 404. No hay chequeo de family_id
 * escrito acá a mano, igual que en el resto de la app.
 */

const BUCKET = "avatars";

/** Una hora. Al cambiar la foto cambia el uuid de la ruta, así que la caché
 *  vieja apunta a un archivo que ya no se pide: no hace falta invalidarla. */
const MAX_AGE_SECONDS = 3600;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ memberId: string }> },
) {
  const { memberId } = await params;
  const supabase = await createClient();

  const { data: member } = await supabase
    .from("family_members")
    .select("avatar_path")
    .eq("id", memberId)
    .maybeSingle();

  if (!member?.avatar_path) {
    // 404 y no un placeholder: con `alt=""` el navegador no dibuja nada y se
    // ven las iniciales que están abajo. Un placeholder gris taparía eso.
    return new NextResponse(null, { status: 404 });
  }

  const { data: file, error } = await supabase.storage
    .from(BUCKET)
    .download(member.avatar_path);

  if (error || !file) return new NextResponse(null, { status: 404 });

  return new NextResponse(file, {
    headers: {
      "Content-Type": file.type || "image/webp",
      // `private`: es la foto de una persona, no la cachea ningún proxy
      // compartido en el camino, solo el navegador de quien la pidió.
      "Cache-Control": `private, max-age=${MAX_AGE_SECONDS}`,
    },
  });
}
