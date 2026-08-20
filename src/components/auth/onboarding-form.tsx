"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { createFamily, joinFamily, onboardingMessage } from "@/lib/auth/onboarding";

type Tab = "crear" | "unirme";

export function OnboardingForm({ initialCode }: { initialCode?: string }) {
  const router = useRouter();
  // Si llegó por un link de invitación, la pestaña útil es la de unirse.
  const [tab, setTab] = useState<Tab>(initialCode ? "unirme" : "crear");
  const [familyName, setFamilyName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [code, setCode] = useState(initialCode ?? "");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);

    try {
      if (tab === "crear") {
        await createFamily(familyName, displayName);
      } else {
        await joinFamily(code, displayName);
      }
      router.replace("/");
      router.refresh();
    } catch (error) {
      toast.error(onboardingMessage(error));
      setPending(false);
    }
  }

  return (
    <div className="space-y-5">
      <div
        role="tablist"
        aria-label="Cómo empezar"
        className="grid grid-cols-2 gap-1 rounded-app bg-surface-2 p-1"
      >
        {(["crear", "unirme"] as const).map((value) => (
          <button
            key={value}
            role="tab"
            type="button"
            aria-selected={tab === value}
            onClick={() => setTab(value)}
            className={
              tab === value
                ? "rounded-[calc(var(--radius)-0.25rem)] bg-surface py-2.5 text-sm font-semibold text-fg shadow-sm"
                : "rounded-[calc(var(--radius)-0.25rem)] py-2.5 text-sm font-medium text-muted"
            }
          >
            {value === "crear" ? "Crear la familia" : "Tengo un código"}
          </button>
        ))}
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        {tab === "crear" ? (
          <div>
            <Label htmlFor="familyName">Nombre de la familia</Label>
            <Input
              id="familyName"
              required
              maxLength={60}
              value={familyName}
              onChange={(e) => setFamilyName(e.target.value)}
              placeholder="Casa Gutmark"
            />
          </div>
        ) : (
          <div>
            <Label htmlFor="code">Código de invitación</Label>
            <Input
              id="code"
              required
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="ABC234"
              maxLength={6}
              autoCapitalize="characters"
              autoComplete="off"
              // Monoespaciado y espaciado: un código de 6 caracteres se copia
              // mirando la pantalla del otro, y así no se confunde nada.
              className="text-center font-mono text-xl tracking-[0.4em]"
            />
          </div>
        )}

        <div>
          <Label htmlFor="displayName">Tu nombre</Label>
          <Input
            id="displayName"
            required
            maxLength={40}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Como te llaman en casa"
          />
        </div>

        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending ? "Un segundo..." : tab === "crear" ? "Crear la familia" : "Unirme"}
        </Button>
      </form>

      {tab === "unirme" ? (
        <p className="text-center text-xs text-muted">
          Vas a entrar como integrante. Un adulto de la casa puede darte permisos de
          administrador después.
        </p>
      ) : null}
    </div>
  );
}
