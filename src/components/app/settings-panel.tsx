"use client";

import { Bell, BellOff, ChevronRight, LogOut, Moon, Smartphone, Sun } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";

import { InstallCard } from "@/components/app/install-card";
import { Wordmark } from "@/components/brand/logo";
import { AvatarPicker } from "@/components/family/avatar-picker";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { SECONDARY_NAV } from "@/lib/nav";
import type { FamilyMemberRow } from "@/types/database";
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

/**
 * "Más": el cajón de todo lo que no entra en las cinco pestañas del teléfono,
 * más los ajustes.
 *
 * En escritorio estos destinos ya están en la barra lateral, así que la grilla
 * de arriba es redundante ahí — pero se deja igual: quien viene del teléfono
 * los busca acá, y esconderlos según el tamaño de pantalla obliga a aprender
 * dos mapas distintos de la misma app.
 */
export function SettingsPanel({
  email,
  isParent,
  member,
  familyId,
}: {
  email: string;
  isParent: boolean;
  member: FamilyMemberRow;
  familyId: string;
}) {
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

  const sections = SECONDARY_NAV.filter((item) => !item.parentOnly || isParent);

  return (
    <>
      <PageHeader title="Más" subtitle="Todo lo demás de la casa, y tus ajustes." />

      <div className="space-y-5">
        {/* Instalar va primero: es el paso que convierte esto en una app que se
            abre desde la pantalla de inicio en vez de un link perdido en el
            chat de la familia. La tarjeta se esconde sola si ya está instalada
            en un navegador que no ofrece instalación. */}
        <InstallCard />

        <Card className="flex items-center gap-4">
          {/* Cada uno puede cambiar SU foto aunque no administre la casa: es lo
              que permite la policy `family_members_update`. */}
          <AvatarPicker member={member} familyId={familyId} size="lg" />
          <div className="min-w-0">
            <p className="font-display text-base font-bold text-fg">
              {member.display_name}
            </p>
            <p className="text-sm text-muted">
              {member.avatar_path ? "Tocá la cámara para cambiar tu foto." : "Ponete una foto."}
            </p>
          </div>
        </Card>

        <nav className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sections.map(({ href, label, icon: Icon, hint }) => (
            <Link key={href} href={href}>
              <Card className="flex h-full items-center gap-3 transition-shadow hover:shadow-float">
                <span className="grid size-11 shrink-0 place-items-center rounded-full bg-secondary-soft text-secondary-soft-fg">
                  <Icon className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-display text-sm font-bold text-fg">{label}</span>
                  <span className="block truncate text-xs text-muted">{hint}</span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-muted" />
              </Card>
            </Link>
          ))}
        </nav>

        <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
          <Card className="divide-y divide-border p-0">
            <button
              type="button"
              onClick={() => setDarkMode(!dark)}
              className="flex w-full items-center gap-3 p-4 text-left"
            >
              {dark ? (
                <Moon className="size-5 text-muted" />
              ) : (
                <Sun className="size-5 text-muted" />
              )}
              <span className="flex-1 text-sm font-semibold text-fg">
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
          </Card>

          <div className="space-y-4">
            <Card>
              <p className="text-xs text-muted">Sesión iniciada como</p>
              <p className="truncate text-sm font-semibold text-fg">{email}</p>
              <Button variant="outline" className="mt-3 w-full" onClick={signOut}>
                <LogOut /> Cerrar sesión
              </Button>
            </Card>

            {/* Se listan las ideas que quedaron afuera en vez de esconderlas:
                así nadie las busca durante diez minutos creyendo que existen. */}
            <Card tone="vault">
              <h2 className="font-display text-sm font-bold text-fg">Ideas para más adelante</h2>
              <ul className="mt-2 space-y-1 text-sm text-muted">
                <li>Vencimientos del hogar y el auto (VTV, seguro, service)</li>
                <li>Álbum de recuerdos y cumpleaños</li>
                <li>Panel de equidad: quién hizo cuánto de verdad</li>
              </ul>
            </Card>
          </div>
        </div>

        <footer className="flex justify-center pt-2">
          <Wordmark showTagline />
        </footer>
      </div>
    </>
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
          <p className="text-sm font-semibold text-fg">Instalá la app para recibir avisos</p>
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
          <p className="text-sm font-semibold text-fg">Avisos bloqueados</p>
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
        <span className="block text-sm font-semibold text-fg">Avisos en este teléfono</span>
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
            : "h-6 w-11 shrink-0 rounded-full bg-border-strong p-0.5"
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
