import Link from "next/link";

import { MemberAvatar } from "@/components/app/member-chip";
import { NidoMark } from "@/components/brand/logo";
import { APP_NAME } from "@/lib/brand";
import type { FamilyMemberRow } from "@/types/database";

/**
 * Barra superior del teléfono.
 *
 * Fina a propósito: en una pantalla de 667px de alto, cada píxel de cromo es
 * un píxel menos de contenido. Lleva la marca —para que la PWA instalada no
 * parezca una página web suelta— y la cara del que está usando la app, que es
 * también el atajo a los ajustes.
 */
export function MobileTopBar({
  familyName,
  member,
}: {
  familyName: string;
  member: FamilyMemberRow;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-bg/85 backdrop-blur-xl safe-top lg:hidden">
      <div className="mx-auto flex h-14 max-w-lg items-center gap-2.5 px-4">
        <NidoMark className="size-6 shrink-0 text-primary" />
        <span className="min-w-0 flex-1">
          <span className="block font-display text-base font-bold leading-none text-fg">
            {APP_NAME}
          </span>
          <span className="block truncate text-[11px] leading-tight text-muted">
            {familyName}
          </span>
        </span>
        <Link href="/mas" aria-label="Tu cuenta y ajustes" className="shrink-0">
          <MemberAvatar member={member} className="ring-2 ring-surface" />
        </Link>
      </div>
    </header>
  );
}
