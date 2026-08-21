import {
  BookUser,
  CalendarDays,
  FolderLock,
  HeartPulse,
  House,
  MoreHorizontal,
  ShoppingCart,
  Sun,
  Target,
  UtensilsCrossed,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Descripción corta: solo se muestra en la grilla de "Más". */
  hint?: string;
  /** La pantalla existe para adultos. RLS ya la vacía; esto la esconde. */
  parentOnly?: boolean;
};

/**
 * Los cinco destinos de la barra inferior.
 *
 * Cinco y no seis: seis pestañas en un teléfono de 360px dan celdas de 60px
 * donde el texto se corta y el pulgar erra. Lo que no entra vive en "Más" —y
 * en la barra lateral de escritorio, donde entra todo junto.
 *
 * "Hoy" se ganó un lugar propio sacando a "Familia": el expediente se abre
 * dos veces por mes y el día se mira ocho veces por día.
 */
export const PRIMARY_NAV: NavItem[] = [
  { href: "/", label: "Inicio", icon: House },
  { href: "/dia", label: "Hoy", icon: Sun },
  { href: "/planner", label: "Semana", icon: CalendarDays },
  { href: "/compras", label: "Compras", icon: ShoppingCart },
];

/** Todo lo demás. En escritorio va en la barra lateral; en el teléfono, en /mas. */
export const SECONDARY_NAV: NavItem[] = [
  {
    href: "/objetivos",
    label: "Objetivos",
    icon: Target,
    hint: "Lo que la casa se propuso, en pasos",
  },
  {
    href: "/comidas",
    label: "Comidas",
    icon: UtensilsCrossed,
    hint: "Menú de la semana, recetas y despensa",
  },
  {
    href: "/familia",
    label: "Familia",
    icon: Users,
    hint: "Integrantes y expediente de cada uno",
  },
  {
    href: "/finanzas",
    label: "Finanzas",
    icon: Wallet,
    hint: "Ingresos, reparto y vencimientos",
    parentOnly: true,
  },
  {
    href: "/documentos",
    label: "Documentos",
    icon: FolderLock,
    hint: "La caja fuerte de la casa",
    parentOnly: true,
  },
  {
    href: "/contactos",
    label: "Contactos",
    icon: BookUser,
    hint: "Pediatra, colegio, gasista",
  },
  {
    href: "/emergencia",
    label: "Emergencia",
    icon: HeartPulse,
    hint: "Ficha con lo esencial, funciona sin señal",
  },
];

/** La pastilla de "Más" solo existe en el teléfono. */
export const MORE_ITEM: NavItem = { href: "/mas", label: "Más", icon: MoreHorizontal };

/**
 * Si la ruta actual corresponde al destino.
 *
 * "/" es prefijo de todo, así que se compara exacto; el resto por prefijo para
 * que /familia/<id> siga marcando Familia.
 */
export function isActivePath(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
