import { initials } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { FamilyMemberRow } from "@/types/database";

/**
 * La cara de un integrante en una fila.
 *
 * El color sale de `family_members.color` y es el mismo en toda la app: en el
 * planner, en la tarea y en la compra. Es lo que permite mirar la semana de
 * reojo y saber de quién es cada cosa sin leer un nombre.
 */
export function MemberAvatar({
  member,
  size = "md",
  className,
}: {
  member: Pick<FamilyMemberRow, "display_name" | "color">;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <span
      aria-hidden
      style={{ backgroundColor: member.color }}
      className={cn(
        "grid shrink-0 place-items-center rounded-full font-bold text-white",
        size === "sm" ? "size-6 text-[10px]" : "size-8 text-xs",
        className,
      )}
    >
      {initials(member.display_name)}
    </span>
  );
}

export function MemberChip({
  member,
}: {
  member: Pick<FamilyMemberRow, "display_name" | "color">;
}) {
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
