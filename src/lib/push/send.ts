import "server-only";

import webpush from "web-push";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Envío de Web Push.
 *
 * Usa el admin client porque hay que leer las suscripciones de OTROS
 * integrantes: la policy de `push_subscriptions` limita cada uno a las suyas,
 * que es lo correcto para el navegador y justo lo que impide mandarle un aviso
 * a otro. Todo call site tiene que resolver los destinatarios a partir de la
 * familia del que llama, nunca de un id que venga del cliente.
 */

let configured = false;

function configure() {
  if (configured) return;

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT ?? "mailto:hola@example.com";

  if (!publicKey || !privateKey) {
    throw new Error("Faltan las claves VAPID. Correr `npm run push:keys`.");
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
}

export type PushMessage = {
  title: string;
  body: string;
  /** A dónde lleva el toque en la notificación. */
  url?: string;
  /** Agrupa avisos del mismo tipo en una sola tarjeta. */
  tag?: string;
};

/**
 * Manda un aviso a todos los dispositivos de esos perfiles.
 *
 * Devuelve cuántos llegaron. No lanza: un push que falla nunca puede tumbar la
 * acción que lo disparó — que una tarea no se pueda asignar porque el teléfono
 * de la otra persona tiene un endpoint vencido sería absurdo.
 */
export async function sendPushToProfiles(
  profileIds: string[],
  message: PushMessage,
): Promise<number> {
  if (profileIds.length === 0) return 0;

  configure();
  const admin = createAdminClient();

  const { data: subscriptions } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .in("profile_id", profileIds);

  if (!subscriptions?.length) return 0;

  const payload = JSON.stringify(message);
  const deadEndpoints: string[] = [];

  const results = await Promise.allSettled(
    subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          },
          payload,
        );
      } catch (error) {
        // 404 y 410 son definitivos: el navegador desinstaló la PWA o revocó
        // el permiso. Esa fila no va a servir nunca más, así que se limpia en
        // vez de reintentar para siempre.
        const statusCode = (error as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          deadEndpoints.push(subscription.endpoint);
        }
        throw error;
      }
    }),
  );

  if (deadEndpoints.length > 0) {
    await admin.from("push_subscriptions").delete().in("endpoint", deadEndpoints);
  }

  return results.filter((r) => r.status === "fulfilled").length;
}

/** Los perfiles con cuenta de una familia, salvo el que dispara el aviso. */
export async function profilesToNotify(
  familyId: string,
  exceptProfileId?: string,
): Promise<string[]> {
  const admin = createAdminClient();

  const { data } = await admin
    .from("profiles")
    .select("id")
    .eq("family_id", familyId)
    .eq("is_active", true);

  return (data ?? []).map((p) => p.id).filter((id) => id !== exceptProfileId);
}
