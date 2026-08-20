"use client";

import { Baby, Check, Copy, RefreshCw, Shield, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { MemberAvatar } from "@/components/app/member-chip";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { createClient } from "@/lib/supabase/client";
import type { FamilyMemberRow, FamilyRow, UserRole } from "@/types/database";

type ProfileLite = { id: string; role: UserRole; is_active: boolean };

/** Colores de integrante. Distinguibles entre sí también para daltonismo. */
const MEMBER_COLORS = [
  "#6D4AFF",
  "#0EA5E9",
  "#16A34A",
  "#EA580C",
  "#DB2777",
  "#CA8A04",
];

export function FamilyPanel({
  family,
  members,
  currentMemberId,
  isParent,
  profiles,
}: {
  family: FamilyRow;
  members: FamilyMemberRow[];
  currentMemberId: string;
  isParent: boolean;
  profiles: ProfileLite[];
}) {
  const router = useRouter();
  const [inviteCode, setInviteCode] = useState(family.invite_code);
  const [copied, setCopied] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  const roleOf = new Map(profiles.map((p) => [p.id, p.role]));

  async function copyInvite() {
    const url = `${window.location.origin}/unirse/${inviteCode}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard falla sin HTTPS o sin permiso: mostrar el código igual sirve.
      toast.info(`Código: ${inviteCode}`);
    }
  }

  async function rotateCode() {
    const { data, error } = await createClient().rpc("rotate_invite_code");
    if (error || !data) {
      toast.error("No se pudo renovar el código.");
      return;
    }
    setInviteCode(data);
    toast.success("Código nuevo. El anterior ya no sirve.");
  }

  async function setRole(profileId: string, role: UserRole) {
    const { error } = await createClient().rpc("set_member_role", {
      p_profile_id: profileId,
      p_role: role,
    });

    if (error) {
      toast.error(
        error.message.includes("tu propio rol")
          ? "No podés cambiar tu propio rol."
          : "No se pudo cambiar el rol.",
      );
      return;
    }
    toast.success("Listo. Se aplica cuando esa persona vuelva a entrar.");
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-fg">{family.name}</h1>
        <p className="text-sm text-muted">
          {members.length} {members.length === 1 ? "integrante" : "integrantes"}
        </p>
      </header>

      <ul className="space-y-2">
        {members.map((m) => {
          const role = m.profile_id ? roleOf.get(m.profile_id) : undefined;

          return (
            <li
              key={m.id}
              className="flex items-center gap-3 rounded-app border border-border bg-surface p-3"
            >
              <MemberAvatar member={m} />

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-fg">
                  {m.display_name}
                  {m.id === currentMemberId ? (
                    <span className="text-muted"> · vos</span>
                  ) : null}
                </p>
                <p className="flex items-center gap-1 text-xs text-muted">
                  {m.kind === "dependent" ? (
                    <>
                      <Baby className="size-3" /> Sin cuenta propia
                    </>
                  ) : role === "parent" ? (
                    <>
                      <Shield className="size-3" /> Administra la casa
                    </>
                  ) : (
                    "Integrante"
                  )}
                </p>
              </div>

              {/* Cambiar rol solo lo ve un adulto, y nunca sobre sí mismo: si el
                  único administrador se degrada, no queda nadie que pueda
                  volver a promoverlo. */}
              {isParent && m.profile_id && m.id !== currentMemberId ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setRole(m.profile_id!, role === "parent" ? "child" : "parent")}
                >
                  {role === "parent" ? "Quitar admin" : "Hacer admin"}
                </Button>
              ) : null}
            </li>
          );
        })}
      </ul>

      {isParent ? (
        <>
          <Button variant="outline" className="w-full" onClick={() => setAddOpen(true)}>
            <UserPlus /> Agregar integrante sin cuenta
          </Button>

          <section className="rounded-app border border-border bg-surface p-4">
            <h2 className="text-sm font-semibold text-fg">Invitar a alguien</h2>
            <p className="mt-1 text-xs text-muted">
              Compartí este código. Quien entre lo hace como integrante; después lo podés
              hacer administrador desde acá.
            </p>

            <div className="mt-3 flex items-center gap-2">
              <code className="flex-1 rounded-app bg-surface-2 py-3 text-center font-mono text-xl tracking-[0.35em] text-fg">
                {inviteCode}
              </code>
              <Button size="icon" variant="secondary" onClick={copyInvite} aria-label="Copiar link">
                {copied ? <Check /> : <Copy />}
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={rotateCode}
                aria-label="Renovar código"
                title="Genera uno nuevo e invalida el anterior"
              >
                <RefreshCw />
              </Button>
            </div>
          </section>
        </>
      ) : null}

      <Sheet open={addOpen} onOpenChange={setAddOpen}>
        <SheetContent
          title="Nuevo integrante"
          description="Para alguien que no va a tener cuenta, como un nene chico."
        >
          <AddDependentForm
            usedColors={members.map((m) => m.color)}
            nextPosition={members.length}
            onDone={() => {
              setAddOpen(false);
              router.refresh();
            }}
          />
        </SheetContent>
      </Sheet>
    </div>
  );
}

function AddDependentForm({
  usedColors,
  nextPosition,
  onDone,
}: {
  usedColors: string[];
  nextPosition: number;
  onDone: () => void;
}) {
  const [name, setName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  // Primer color libre: dos integrantes del mismo color arruinan el sistema de
  // reconocerlos de un vistazo en el planner.
  const [color, setColor] = useState(
    MEMBER_COLORS.find((c) => !usedColors.includes(c)) ?? MEMBER_COLORS[0],
  );
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);

    const { error } = await createClient()
      .from("family_members")
      .insert({
        kind: "dependent",
        display_name: name.trim(),
        birth_date: birthDate || null,
        color,
        position: nextPosition,
      });

    setPending(false);

    if (error) {
      toast.error("No se pudo agregar.");
      return;
    }
    onDone();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <Label htmlFor="memberName">Nombre</Label>
        <Input
          id="memberName"
          required
          autoFocus
          maxLength={40}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Julián"
        />
      </div>

      <div>
        <Label htmlFor="birthDate">Fecha de nacimiento</Label>
        <Input
          id="birthDate"
          type="date"
          value={birthDate}
          onChange={(e) => setBirthDate(e.target.value)}
        />
      </div>

      <fieldset>
        <Label>Color</Label>
        <div className="flex gap-2">
          {MEMBER_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              aria-label={`Color ${c}`}
              aria-pressed={color === c}
              style={{ backgroundColor: c }}
              className={
                color === c
                  ? "size-10 scale-110 rounded-full border-2 border-fg"
                  : "size-10 rounded-full border-2 border-transparent"
              }
            />
          ))}
        </div>
      </fieldset>

      <Button type="submit" size="lg" className="w-full" disabled={pending || !name.trim()}>
        {pending ? "Guardando..." : "Agregar"}
      </Button>
    </form>
  );
}
