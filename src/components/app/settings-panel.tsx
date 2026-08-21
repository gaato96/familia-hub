"use client";

import {
  Bell,
  BellOff,
  ChevronRight,
  LogOut,
  Moon,
  Smartphone,
  Sun,
  UtensilsCrossed,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  isSubscribed,
  pushSupport,
  subscribeToPush,
  unsubscribeFromPush,
  type PushSupport,
} from "@/lib/push/client";
import { createClient } from "@/lib/supabase/client";
import {
  getThemeServerSnapshot,
  getThemeSnapshot,
  setDarkMode,
  subscribeTheme,
} from "@/lib/theme";

/**
 * El soporte de push no cambia durante la vida de la pestaña, así que se
 * calcula una vez y se cachea a nivel de módulo. `useSyncExternalStore` exige
 * que `getSnapshot` devuelva el mismo objeto entre renders — devolver uno
 * nuevo cada vez lo manda a un loop infinito.
 */
const SERVER_SUPPORT: PushSupport = { status: "unsupported" };
let cachedSupport: PushSupport | null = null;

const noopSubscribe = () => () => {};

function getSupportSnapshot(): PushSupport {
  cachedSupport ??= pushSupport();
  return cachedSupport;
}

export function SettingsPanel({ email, isParent }: { email: string; isParent: boolean }) {
  const router = useRouter();
  const dark = useSyncExternalStore(subscribeTheme, getThemeSnapshot, getThemeServerSnapshot);
  const support = useSyncExternalStore(
    noopSubscribe,
    getSupportSnapshot,
    () => SERVER_SUPPORT,
  );
  const [subscribed, setSubscribed] = useState(false);
  const [pushPending, setPushPending] = useState(false);

  useEffect(() => {
    // setState dentro de un `.then()` es asincrónico y no encadena renders,
    // a diferencia de llamarlo en el cuerpo del efecto.
    let cancelled = false;
    void isSubscribed().then((value) => {
      if (!cancelled) setSubscribed(value);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function toggleTheme() {
    setDarkMode(!dark);
  }

  async function togglePush() {
    setPushPending(true);
    try {
      if (subscribed) {
        await unsubscribeFromPush();
        setSubscribed(false);
      } else {
        const ok = await subscribeToPush();
        setSubscribed(ok);
        if (!ok) toast.error("No diste permiso para las notificaciones.");
      }
    } catch {
      toast.error("No se pudo cambiar las notificaciones.");
    } finally {
      setPushPending(false);
    }
  }

  async function signOut() {
    await createClient().auth.signOut();
    router.replace("/ingresar");
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold tracking-tight text-fg">Más</h1>

      {/* Estos dos viven acá y no en la bottom nav: seis pestañas no entran
          cómodas en un teléfono de 360px. */}
      <nav className="divide-y divide-border overflow-hidden rounded-app border border-border bg-surface">
        <QuickLink
          href="/comidas"
          icon={<UtensilsCrossed className="size-5 text-muted" />}
          label="Comidas y despensa"
          hint="Menú de la semana, recetas y lo que hay en casa."
        />
        {/* Finanzas solo la ven los adultos. */}
        {isParent ? (
          <QuickLink
            href="/finanzas"
            icon={<Wallet className="size-5 text-primary" />}
            label="Finanzas del hogar"
            hint="Ingresos, reparto y vencimientos."
          />
        ) : null}
      </nav>

      <section className="divide-y divide-border overflow-hidden rounded-app border border-border bg-surface">
        <button
          type="button"
          onClick={toggleTheme}
          className="flex w-full items-center gap-3 p-4 text-left"
        >
          {dark ? <Moon className="size-5 text-muted" /> : <Sun className="size-5 text-muted" />}
          <span className="flex-1 text-sm font-medium text-fg">
            {dark ? "Modo oscuro" : "Modo claro"}
          </span>
          <ChevronRight className="size-4 text-muted" />
        </button>

        <PushRow
          support={support}
          subscribed={subscribed}
          pending={pushPending}
          onToggle={togglePush}
        />
      </section>

      <section className="rounded-app border border-border bg-surface p-4">
        <p className="text-xs text-muted">Sesión iniciada como</p>
        <p className="truncate text-sm font-medium text-fg">{email}</p>
        <Button variant="outline" className="mt-3 w-full" onClick={signOut}>
          <LogOut /> Cerrar sesión
        </Button>
      </section>

      {/* Se listan las secciones que faltan en vez de esconderlas: así nadie
          busca finanzas durante diez minutos creyendo que se le perdió. */}
      <section className="rounded-app border border-dashed border-border p-4">
        <h2 className="text-sm font-semibold text-fg">Ideas para más adelante</h2>
        <ul className="mt-2 space-y-1 text-sm text-muted">
          <li>Vencimientos del hogar y el auto (VTV, seguro, service)</li>
          <li>Álbum de recuerdos y cumpleaños</li>
        </ul>
      </section>
    </div>
  );
}

function PushRow({
  support,
  subscribed,
  pending,
  onToggle,
}: {
  support: PushSupport;
  subscribed: boolean;
  pending: boolean;
  onToggle: () => void;
}) {
  if (support.status === "needs-install") {
    return (
      <div className="flex items-start gap-3 p-4">
        <Smartphone className="mt-0.5 size-5 shrink-0 text-muted" />
        <div>
          <p className="text-sm font-medium text-fg">Instalá la app para recibir avisos</p>
          <p className="mt-0.5 text-xs text-muted">
            En iPhone, tocá Compartir y después &ldquo;Agregar a inicio&rdquo;. Los avisos solo
            funcionan con la app instalada — es una limitación de Apple, no de la app.
          </p>
        </div>
      </div>
    );
  }

  if (support.status === "denied") {
    return (
      <div className="flex items-start gap-3 p-4">
        <BellOff className="mt-0.5 size-5 shrink-0 text-muted" />
        <div>
          <p className="text-sm font-medium text-fg">Avisos bloqueados</p>
          <p className="mt-0.5 text-xs text-muted">
            Los bloqueaste desde el navegador. Se habilitan en los ajustes del sitio.
          </p>
        </div>
      </div>
    );
  }

  if (support.status === "unsupported") {
    return (
      <div className="flex items-center gap-3 p-4">
        <BellOff className="size-5 text-muted" />
        <p className="text-sm text-muted">Este navegador no soporta avisos.</p>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={pending}
      className="flex w-full items-center gap-3 p-4 text-left disabled:opacity-60"
    >
      <Bell className="size-5 text-muted" />
      <span className="flex-1">
        <span className="block text-sm font-medium text-fg">Avisos en este teléfono</span>
        <span className="block text-xs text-muted">
          {subscribed
            ? "Activados: tareas asignadas, notas nuevas y el resumen del domingo."
            : "Desactivados en este dispositivo."}
        </span>
      </span>
      <span
        aria-hidden
        className={
          subscribed
            ? "h-6 w-11 shrink-0 rounded-full bg-primary p-0.5"
            : "h-6 w-11 shrink-0 rounded-full bg-border p-0.5"
        }
      >
        <span
          className={
            subscribed
              ? "block size-5 translate-x-5 rounded-full bg-white transition-transform"
              : "block size-5 rounded-full bg-white transition-transform"
          }
        />
      </span>
    </button>
  );
}

function QuickLink({
  href,
  icon,
  label,
  hint,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  hint: string;
}) {
  return (
    <Link href={href} className="flex items-center gap-3 p-4">
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-surface-2">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-fg">{label}</span>
        <span className="block truncate text-xs text-muted">{hint}</span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-muted" />
    </Link>
  );
}
