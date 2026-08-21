"use client";

import { Settings } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { MemberAvatar } from "@/components/app/member-chip";
import { HorneroBadge } from "@/components/brand/logo";
import { APP_NAME } from "@/lib/brand";
import { isActivePath, PRIMARY_NAV, SECONDARY_NAV, type NavItem } from "@/lib/nav";
import { cn } from "@/lib/utils";
import type { FamilyMemberRow } from "@/types/database";

/**
 * Barra lateral de escritorio.
 *
 * La app nació para el teléfono y va a seguir usándose ahí, pero quien la
 * administra trabaja en una pantalla grande. Estirar el layout de 360px a
 * 1600px deja una columna flaca en el medio y dos desiertos a los costados;
 * peor todavía, deja "Más" —un menú que existe solo porque en el teléfono no
 * entran seis pestañas— en una pantalla donde entran veinte.
 *
 * Así que en escritorio no hay "Más": están los doce destinos a la vista, que
 * es la ventaja de tener lugar.
 */
export function AppSidebar({
  familyName,
  member,
  isParent,
}: {
  familyName: string;
  member: FamilyMemberRow;
  isParent: boolean;
}) {
  const pathname = usePathname();
  const secondary = SECONDARY_NAV.filter((item) => !item.parentOnly || isParent);

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-40 hidden w-64 flex-col lg:flex",
        "border-r border-border bg-surface",
      )}
    >
      <div className="flex items-center gap-2.5 px-5 py-5">
        <HorneroBadge />
        <span className="min-w-0">
          <span className="block font-display text-lg font-bold leading-tight text-fg">
            {APP_NAME}
          </span>
          <span className="block truncate text-xs text-muted">{familyName}</span>
        </span>
      </div>

      <nav aria-label="Secciones" className="flex-1 overflow-y-auto px-3 pb-4 thin-scroll">
        <ul className="space-y-0.5">
          {PRIMARY_NAV.map((item) => (
            <SidebarLink key={item.href} item={item} pathname={pathname} />
          ))}
        </ul>

        <p className="px-3 pb-1.5 pt-5 text-[11px] font-bold uppercase tracking-wider text-muted/70">
          La casa
        </p>
        <ul className="space-y-0.5">
          {secondary.map((item) => (
            <SidebarLink key={item.href} item={item} pathname={pathname} />
          ))}
        </ul>
      </nav>

      <Link
        href="/mas"
        className={cn(
          "m-3 flex items-center gap-2.5 rounded-app-sm p-2.5 transition-colors hover:bg-surface-2",
          isActivePath(pathname, "/mas") && "bg-surface-2",
        )}
      >
        <MemberAvatar member={member} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold text-fg">
            {member.display_name}
          </span>
          <span className="block text-xs text-muted">
            {isParent ? "Administra la casa" : "Integrante"}
          </span>
        </span>
        <Settings className="size-4 shrink-0 text-muted" />
      </Link>
    </aside>
  );
}

function SidebarLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const active = isActivePath(pathname, item.href);
  const Icon = item.icon;

  return (
    <li>
      <Link
        href={item.href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex items-center gap-3 rounded-full px-3 py-2.5 text-sm transition-colors",
          active
            ? "bg-primary text-primary-fg shadow-press"
            : "text-muted hover:bg-surface-2 hover:text-fg",
        )}
      >
        <Icon className={cn("size-[18px] shrink-0", active && "stroke-[2.5]")} />
        <span className={cn("font-display font-bold", !active && "font-semibold")}>
          {item.label}
        </span>
      </Link>
    </li>
  );
}
