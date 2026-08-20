"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

type Mode = "signin" | "signup";

/**
 * Alta e ingreso con email y contraseña.
 *
 * Corre en el cliente a propósito: el cliente de browser de `@supabase/ssr`
 * escribe las cookies de sesión en el formato que después lee el server, así
 * que no hace falta una Server Action que replique el manejo de cookies.
 *
 * Después de entrar se hace `router.refresh()` y NO `router.push()`: el proxy
 * es el que sabe a dónde va cada uno (a la app si ya tiene familia, a
 * /bienvenida si todavía no), y duplicar esa decisión acá sería tener dos
 * lugares que se pueden desincronizar.
 */
export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [checkInbox, setCheckInbox] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);

    const supabase = createClient();

    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;

        // Si el proyecto tiene confirmación de mail activada, signUp devuelve
        // usuario pero sin sesión. Para esta app conviene tenerla apagada
        // (son cuatro cuentas y las crea la familia), pero si está prendida
        // hay que decirlo en vez de dejar la pantalla colgada.
        if (!data.session) {
          setCheckInbox(true);
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }

      const next = params.get("next");
      router.replace(next && next.startsWith("/") ? next : "/");
      router.refresh();
    } catch (error) {
      toast.error(messageFor(error));
    } finally {
      setPending(false);
    }
  }

  if (checkInbox) {
    return (
      <div className="rounded-app border border-border bg-surface p-4 text-sm text-fg">
        <p className="font-semibold">Revisá tu correo</p>
        <p className="mt-1 text-muted">
          Te mandamos un link a <span className="text-fg">{email}</span> para confirmar la
          cuenta. Cuando lo abras, volvé acá y entrá.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <Label htmlFor="email">Correo</Label>
        <Input
          id="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="tu@correo.com"
        />
      </div>

      <div>
        <Label htmlFor="password">Contraseña</Label>
        <Input
          id="password"
          type="password"
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={mode === "signup" ? "Mínimo 8 caracteres" : ""}
        />
      </div>

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Un segundo..." : mode === "signup" ? "Crear cuenta" : "Entrar"}
      </Button>
    </form>
  );
}

/** Los mensajes de Supabase vienen en inglés y no sirven para mostrar tal cual. */
function messageFor(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);

  if (raw.includes("Invalid login credentials")) return "El correo o la contraseña no coinciden.";
  if (raw.includes("already registered")) return "Ya existe una cuenta con ese correo.";
  if (raw.includes("Password should be")) return "La contraseña necesita al menos 8 caracteres.";
  if (raw.includes("Email rate limit")) return "Demasiados intentos. Probá en un rato.";
  if (raw.toLowerCase().includes("fetch")) return "Sin conexión. Revisá internet e intentá de nuevo.";

  return "No se pudo completar. Intentá de nuevo.";
}
