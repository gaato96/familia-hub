"use client";

import { Camera, Loader2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { MemberAvatar } from "@/components/app/member-chip";
import { removeAvatar, uploadAvatar } from "@/lib/records/avatar";
import { cn } from "@/lib/utils";
import type { FamilyMemberRow } from "@/types/database";

/**
 * Cambiar la foto de un integrante.
 *
 * El input de archivo va oculto y lo dispara el botón de la cámara: el control
 * nativo de `<input type="file">` es feo en todos los navegadores y no se puede
 * estilar. En el teléfono, tocarlo abre la hoja del sistema con "Cámara" y
 * "Fototeca" — por eso NO lleva el atributo `capture`, que forzaría la cámara y
 * dejaría afuera la foto que ya está en el carrete, que es de donde sale la
 * mayoría.
 *
 * Quién puede tocar esto lo decide RLS (`family_members_update`): un adulto
 * edita a cualquiera, el resto solo su propia ficha. Acá se recibe ya resuelto
 * para no ofrecer un botón que va a rebotar.
 */
export function AvatarPicker({
  member,
  familyId,
  size = "lg",
  className,
}: {
  member: FamilyMemberRow;
  familyId: string;
  size?: "md" | "lg" | "xl";
  className?: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function onPick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Se limpia el input SIEMPRE: sin esto, elegir la misma foto dos veces
    // seguidas no dispara `change` y parece que el botón dejó de andar.
    event.target.value = "";
    if (!file) return;

    setBusy(true);
    try {
      await uploadAvatar({
        file,
        familyId,
        memberId: member.id,
        previousPath: member.avatar_path,
      });
      toast.success("Foto actualizada.");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo subir la foto.");
    } finally {
      setBusy(false);
    }
  }

  async function onRemove() {
    if (!member.avatar_path) return;
    setBusy(true);
    try {
      await removeAvatar({ memberId: member.id, path: member.avatar_path });
      toast.success("Foto sacada.");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo sacar la foto.");
    } finally {
      setBusy(false);
    }
  }

  const badgeSize = size === "md" ? "size-6" : "size-8";

  return (
    <div className={cn("relative shrink-0", className)}>
      <MemberAvatar
        member={member}
        size={size}
        className={cn(busy && "opacity-50", "ring-2 ring-surface")}
      />

      {busy ? (
        <span className="absolute inset-0 grid place-items-center">
          <Loader2 className="size-5 animate-spin text-white drop-shadow" />
        </span>
      ) : null}

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        aria-label={
          member.avatar_path
            ? `Cambiar la foto de ${member.display_name}`
            : `Poner una foto a ${member.display_name}`
        }
        className={cn(
          "absolute -bottom-1 -right-1 grid place-items-center rounded-full",
          "bg-primary text-primary-fg shadow-press ring-2 ring-surface",
          "transition-transform active:scale-95 disabled:opacity-50",
          badgeSize,
        )}
      >
        <Camera className={size === "md" ? "size-3" : "size-4"} />
      </button>

      {member.avatar_path && size !== "md" ? (
        <button
          type="button"
          onClick={onRemove}
          disabled={busy}
          aria-label={`Sacar la foto de ${member.display_name}`}
          className={cn(
            "absolute -bottom-1 -left-1 grid place-items-center rounded-full",
            "bg-surface text-muted shadow-press ring-2 ring-surface",
            "transition-colors hover:text-danger disabled:opacity-50",
            badgeSize,
          )}
        >
          <Trash2 className="size-3.5" />
        </button>
      ) : null}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={onPick}
        className="hidden"
        tabIndex={-1}
      />
    </div>
  );
}
