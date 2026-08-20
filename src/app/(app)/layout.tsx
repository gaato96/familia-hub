import { BottomNav } from "@/components/app/bottom-nav";
import { requireFamily } from "@/lib/auth/context";

/**
 * Shell de la app con sesión. `requireFamily()` acá adentro es lo que garantiza
 * que ninguna pantalla del grupo se renderice sin familia resuelta — y como
 * está envuelto en `cache()` de React, la página que va adentro lo vuelve a
 * pedir sin pagar el viaje de nuevo.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireFamily();

  return (
    <div className="min-h-dvh bg-bg">
      {/* pb-20 deja lugar a la bottom nav fija; sin esto la última fila de
          cualquier lista queda tapada y parece que la lista termina antes. */}
      <div className="mx-auto max-w-lg px-4 pb-20 pt-4">{children}</div>
      <BottomNav />
    </div>
  );
}
