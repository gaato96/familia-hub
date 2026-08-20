import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { addDaysIso, startOfWeekAr, todayInAr } from "@/lib/dates";
import { sendPushToProfiles } from "@/lib/push/send";

/**
 * Resumen semanal del domingo a la noche.
 *
 * El plan hobby de Vercel permite UNA ejecución de cron por día, así que el job
 * corre todos los días y filtra por día de la semana acá adentro. Es más barato
 * que pagar un plan por un push semanal.
 *
 * Corre sin sesión: usa el admin client y recorre familia por familia. Es el
 * caso donde RLS genuinamente no aplica, porque no hay un "quién pregunta".
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SUNDAY = 0;

export async function GET(request: Request) {
  // Vercel manda este header en sus crons; el secreto evita que cualquiera
  // dispare los push desde afuera.
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const today = todayInAr();
  const isSunday = new Date(`${today}T12:00:00Z`).getUTCDay() === SUNDAY;

  if (!isSunday) {
    return NextResponse.json({ skipped: "no es domingo", today });
  }

  const admin = createAdminClient();

  // La semana que EMPIEZA mañana: el domingo a la noche se mira lo que viene,
  // no lo que ya pasó.
  const monday = startOfWeekAr(addDaysIso(today, 1));
  const sunday = addDaysIso(monday, 6);

  const { data: families } = await admin.from("families").select("id, name");
  let notified = 0;

  for (const family of families ?? []) {
    // Materializar antes de contar: si nadie abrió el planner, las ocurrencias
    // de la semana que viene todavía no existen y el resumen diría "0 tareas".
    await admin.rpc("ensure_task_instances", { p_until: sunday, p_family_id: family.id });

    const [
      { count: taskCount },
      { count: eventCount },
      { data: dueExpenses },
      { data: profiles },
    ] = await Promise.all([
      admin
        .from("task_instances")
        .select("id", { count: "exact", head: true })
        .eq("family_id", family.id)
        .gte("due_date", monday)
        .lte("due_date", sunday)
        .eq("status", "pending"),
      admin
        .from("events")
        .select("id", { count: "exact", head: true })
        .eq("family_id", family.id)
        .gte("starts_at", `${monday}T00:00:00-03:00`)
        .lte("starts_at", `${sunday}T23:59:59-03:00`),
      // Vencimientos impagos hasta el domingo que viene, incluidos los que ya
      // vencieron: una factura de la semana pasada sin pagar es justamente lo
      // que hay que recordar el domingo a la noche.
      admin
        .from("expenses")
        .select("amount_cents")
        .eq("family_id", family.id)
        .is("paid_on", null)
        .lte("due_date", sunday),
      admin.from("profiles").select("id").eq("family_id", family.id).eq("is_active", true),
    ]);

    const tasks = taskCount ?? 0;
    const events = eventCount ?? 0;
    const bills = dueExpenses?.length ?? 0;

    // Una semana vacía no genera aviso: un push que dice "no hay nada" enseña
    // a ignorar los push.
    if (tasks === 0 && events === 0 && bills === 0) continue;

    notified += await sendPushToProfiles(
      (profiles ?? []).map((p) => p.id),
      {
        title: "La semana que viene",
        body: [
          tasks > 0 ? `${tasks} ${tasks === 1 ? "tarea" : "tareas"}` : null,
          events > 0 ? `${events} ${events === 1 ? "evento" : "eventos"}` : null,
          bills > 0 ? `${bills} ${bills === 1 ? "vencimiento" : "vencimientos"}` : null,
        ]
          .filter(Boolean)
          .join(" · "),
        url: `/planner?semana=${monday}`,
        tag: "resumen-semanal",
      },
    );
  }

  return NextResponse.json({ ok: true, week: monday, notified });
}
