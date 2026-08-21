import { CalendarClock, ShoppingCart, Target, FolderLock } from "lucide-react";

import { HorneroMark } from "@/components/brand/logo";
import { APP_NAME, APP_TAGLINE } from "@/lib/brand";

const HIGHLIGHTS = [
  { icon: CalendarClock, text: "El día de cada uno, en bloques" },
  { icon: Target, text: "Objetivos de la casa, en pasos" },
  { icon: ShoppingCart, text: "Compras y menú, sincronizados" },
  { icon: FolderLock, text: "El expediente de cada integrante" },
];

/**
 * Pantalla de entrada.
 *
 * Dos paneles en escritorio y uno solo en el teléfono. El panel de la
 * izquierda no es decoración: es lo primero que ve alguien a quien le pasaron
 * un link de invitación y todavía no sabe qué es esto. En un teléfono ese
 * panel se cae —ahí no hay lugar para explicar nada y lo único que importa es
 * llegar al campo de correo sin scrollear.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[1.1fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-primary p-12 text-primary-fg lg:flex lg:flex-col lg:justify-between">
        {/* Dos círculos difusos del color de acento: dan profundidad sin cargar
            una imagen, que en una pantalla de login es peso muerto. */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 size-96 rounded-full bg-accent/30 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-32 -left-16 size-80 rounded-full bg-accent/20 blur-3xl"
        />

        <div className="relative flex items-center gap-3">
          <HorneroMark className="size-9" />
          <span className="font-display text-2xl font-bold tracking-tight">{APP_NAME}</span>
        </div>

        <div className="relative max-w-md">
          <h2 className="font-display text-4xl font-bold leading-tight tracking-tight">
            {APP_TAGLINE}
          </h2>
          <ul className="mt-8 space-y-3.5">
            {HIGHLIGHTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white/15">
                  <Icon className="size-4" />
                </span>
                <span className="text-[15px] opacity-90">{text}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs opacity-70">
          El hornero construye su nido de barro, y lo construye en pareja.
        </p>
      </aside>

      <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-8 px-5 py-12 lg:max-w-md lg:px-12">
        <header className="flex flex-col items-center gap-3 text-center lg:items-start lg:text-left">
          <div className="grid size-14 place-items-center rounded-app bg-primary text-primary-fg shadow-card lg:hidden">
            <HorneroMark className="size-7" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-fg lg:text-3xl">
              {APP_NAME}
            </h1>
            <p className="mt-1 text-sm text-muted lg:hidden">{APP_TAGLINE}</p>
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}
