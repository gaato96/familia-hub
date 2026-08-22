import { AppSidebar } from "@/components/app/app-sidebar";
import { BottomNav } from "@/components/app/bottom-nav";
import { MobileTopBar } from "@/components/app/mobile-top-bar";
import { RoleSync } from "@/components/app/role-sync";
import { requireFamily } from "@/lib/auth/context";

/**
 * Shell de la app con sesión. `requireFamily()` acá adentro es lo que garantiza
 * que ninguna pantalla del grupo se renderice sin familia resuelta — y como
 * está envuelto en `cache()` de React, la página que va adentro lo vuelve a
 * pedir sin pagar el viaje de nuevo.
 *
 * Dos formas del mismo shell:
 *
 * - **Teléfono**: barra fina arriba, contenido en una columna de 512px, barra
 *   de pestañas abajo.
 * - **Escritorio** (`lg`): barra lateral fija de 256px y el contenido en un
 *   ancho de lectura cómodo. No se estira a 1920px: una lista de tareas de
 *   1800px de ancho es ilegible, el ojo pierde el renglón. Las pantallas que
 *   sí aprovechan el ancho (el panel, la semana) abren su propia grilla de
 *   columnas adentro de este contenedor.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { family, member, role, roleIsStale } = await requireFamily();

  return (
    <div className="min-h-dvh bg-bg">
      {/* Si a esta persona la ascendieron mientras tenía la sesión abierta, el
          token todavía dice el rol viejo. Esto pide uno nuevo y se acomoda
          sin que tenga que cerrar sesión. */}
      <RoleSync stale={roleIsStale} />
      <AppSidebar familyName={family.name} member={member} isParent={role === "parent"} />
      <MobileTopBar familyName={family.name} member={member} />

      <div className="lg:pl-64">
        {/* pb-24 deja lugar a la bottom nav fija; sin esto la última fila de
            cualquier lista queda tapada y parece que la lista termina antes. */}
        <main className="mx-auto max-w-lg px-4 pb-24 pt-4 lg:max-w-6xl lg:px-8 lg:pb-12 lg:pt-8">
          {children}
        </main>
      </div>

      <BottomNav />
    </div>
  );
}
