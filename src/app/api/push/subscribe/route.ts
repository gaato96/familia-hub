import { NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

/**
 * Alta y baja del dispositivo para push.
 *
 * Es una API route y no una Server Action porque la llama el flujo del service
 * worker con un `fetch` directo, no un formulario de React.
 */

const subscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;

  if (!claims?.sub || typeof claims.family_id !== "string" || !claims.family_id) {
    return NextResponse.json({ error: "Sin sesión" }, { status: 401 });
  }

  const parsed = subscriptionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Suscripción inválida" }, { status: 400 });
  }

  // upsert por endpoint: reinstalar la PWA en el mismo teléfono devuelve el
  // mismo endpoint, y sin esto se acumularía una fila muerta por reinstalación.
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      family_id: claims.family_id,
      profile_id: claims.sub,
      endpoint: parsed.data.endpoint,
      p256dh: parsed.data.keys.p256dh,
      auth: parsed.data.keys.auth,
      user_agent: request.headers.get("user-agent"),
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: "endpoint" },
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims?.sub) {
    return NextResponse.json({ error: "Sin sesión" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const endpoint = typeof body?.endpoint === "string" ? body.endpoint : null;
  if (!endpoint) {
    return NextResponse.json({ error: "Falta el endpoint" }, { status: 400 });
  }

  // Sin filtro por profile_id: la policy de RLS ya limita el DELETE a las
  // suscripciones propias.
  const { error } = await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
