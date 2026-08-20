"use client";

import { CalendarDays, House, MoreHorizontal, ShoppingCart, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

/**
 * Cinco destinos y no seis.
 *
 * El pedido original listaba seis (sumando Finanzas), pero seis pestañas en un
 * teléfono de 360px dan celdas de 60px: el texto se corta y el pulgar erra.
 * Finanzas vive en "Más" con acceso destacado desde el inicio, que además es
 * coherente con que solo la vean los adultos.
 */
const TABS = [
  { href: "/", label: "Inicio", icon: House },
  { href: "/planner", label: "Semana", icon: CalendarDays },
  { href: "/compras", label: "Compras", icon: ShoppingCart },
  { href: "/familia", label: "Familia", icon: Users },
  { href: "/mas", label: "Más", icon: MoreHorizontal },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Secciones"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 backdrop-blur safe-bottom"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-5">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);

          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium",
                  active ? "text-primary" : "text-muted",
                )}
              >
                <Icon className={cn("size-5", active && "stroke-[2.5]")} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
