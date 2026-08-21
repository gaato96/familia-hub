"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { isActivePath, MORE_ITEM, PRIMARY_NAV } from "@/lib/nav";
import { cn } from "@/lib/utils";

const TABS = [...PRIMARY_NAV, MORE_ITEM];

/**
 * Barra inferior del teléfono. En escritorio no existe: ahí está la barra
 * lateral, que muestra los doce destinos sin esconder nada.
 *
 * La pestaña activa no cambia solo de color: le crece una pastilla suave
 * detrás del ícono. El color solo alcanza si el usuario distingue bien la
 * terracota del gris, y a contraluz en la calle no siempre alcanza.
 */
export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Secciones"
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 lg:hidden",
        "border-t border-border bg-surface/90 backdrop-blur-xl safe-bottom",
      )}
    >
      <ul className="mx-auto grid max-w-lg grid-cols-5">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = isActivePath(pathname, href);

          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className="flex h-16 flex-col items-center justify-center gap-1 pt-1"
              >
                <span
                  className={cn(
                    "grid h-7 w-12 place-items-center rounded-full transition-colors",
                    active ? "bg-primary-soft text-primary-soft-fg" : "text-muted",
                  )}
                >
                  <Icon className={cn("size-5", active && "stroke-[2.5]")} />
                </span>
                <span
                  className={cn(
                    "font-display text-[11px] leading-none",
                    active ? "font-bold text-primary" : "font-semibold text-muted",
                  )}
                >
                  {label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
