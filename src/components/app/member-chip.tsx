import { cn, initials } from "@/lib/utils";
import type { FamilyMemberRow } from "@/types/database";

/**
 * La cara de un integrante en una fila.
 *
 * Si hay foto se muestra la foto; si no, las iniciales sobre el color de la
 * persona. El color sale de `family_members.color` y es el mismo en toda la
 * app: en el planner, en la tarea y en la compra. Es lo que permite mirar la
 * semana de reojo y saber de quién es cada cosa sin leer un nombre — y por eso
 * el color sigue estando aunque haya foto, como aro alrededor.
 */

/** `id` y `avatar_path` son opcionales: la ficha de emergencia arma un
 *  integrante "mínimo" desde `emergency_card()`, que a propósito no devuelve
 *  la foto (esa pantalla tiene que abrir sin señal). */
type AvatarMember = Pick<FamilyMemberRow, "display_name" | "color"> &
  Partial<Pick<FamilyMemberRow, "id" | "avatar_path">>;

const SIZES = {
  sm: "size-6 text-[10px]",
  md: "size-8 text-xs",
  lg: "size-12 text-base",
  xl: "size-20 text-2xl",
} as const;

export function MemberAvatar({
  member,
  size = "md",
  className,
}: {
  member: AvatarMember;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const photo = member.id && member.avatar_path ? `/api/avatar/${member.id}` : null;

  return (
    <span
      aria-hidden
      style={{ backgroundColor: member.color }}
      className={cn(
        "relative grid shrink-0 place-items-center overflow-hidden rounded-full font-bold text-white",
        SIZES[size],
        className,
      )}
    >
      {initials(member.display_name)}
      {photo ? (
        // Encima de las iniciales y no en lugar de ellas: si la imagen no
        // carga —sin señal, o la fila quedó apuntando a un archivo borrado—
        // el `alt` vacío hace que el navegador no dibuje nada y abajo siguen
        // estando las iniciales. Sin fallback, quedaría un círculo vacío.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photo}
          alt=""
          // Sin `loading="lazy"`: son 4 KB y casi siempre están arriba de todo
          // (la barra, el encabezado, la primera fila de la lista). Diferirlas
          // solo agrega un parpadeo de iniciales antes de la foto.
          decoding="async"
          className="absolute inset-0 size-full object-cover"
        />
      ) : null}
    </span>
  );
}

export function MemberChip({ member }: { member: AvatarMember }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted">
      <MemberAvatar member={member} size="sm" />
      {member.display_name}
    </span>
  );
}

/** Para asignaciones sin responsable: mejor decirlo que dejar un hueco. */
export function UnassignedChip() {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted">
      <span
        aria-hidden
        className="grid size-6 place-items-center rounded-full border border-dashed border-border-strong text-[10px]"
      >
        ?
      </span>
      Sin asignar
    </span>
  );
}
