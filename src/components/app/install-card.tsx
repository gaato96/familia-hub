"use client";

import { Check, Share, SquarePlus, Smartphone } from "lucide-react";
import { useSyncExternalStore } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { APP_NAME } from "@/lib/brand";
import {
  getInstallServerState,
  getInstallState,
  promptInstall,
  subscribeToInstall,
} from "@/lib/pwa/install";

/**
 * "Instalá la app en el teléfono."
 *
 * Va arriba de todo en Ajustes y no escondida abajo: instalarla es el paso que
 * convierte la app en algo que la familia abre desde la pantalla de inicio en
 * vez de buscar un link en el chat — y en iPhone es además la única forma de
 * que lleguen los avisos.
 */
export function InstallCard() {
  const state = useSyncExternalStore(
    subscribeToInstall,
    getInstallState,
    getInstallServerState,
  );

  if (state.status === "installed") {
    return (
      <Card tone="success" className="flex items-center gap-3">
        <Check className="size-5 shrink-0" />
        <p className="text-sm font-semibold">
          {APP_NAME} está instalada en este dispositivo.
        </p>
      </Card>
    );
  }

  if (state.status === "available") {
    return (
      <Card tone="primary" className="flex flex-wrap items-center gap-3">
        <Smartphone className="size-5 shrink-0" />
        <p className="min-w-0 flex-1 text-sm">
          <span className="font-bold">Instalá {APP_NAME}</span> para abrirla desde la pantalla
          de inicio y recibir avisos.
        </p>
        <Button
          size="sm"
          className="shrink-0"
          onClick={async () => {
            const accepted = await promptInstall();
            if (!accepted) toast("Podés instalarla más tarde desde acá.");
          }}
        >
          Instalar
        </Button>
      </Card>
    );
  }

  if (state.status === "ios-manual") {
    return (
      <Card tone="info">
        <p className="mb-2 flex items-center gap-2 font-display text-sm font-bold">
          <Smartphone className="size-4" />
          Instalá {APP_NAME} en tu iPhone
        </p>
        <ol className="space-y-1.5 text-sm">
          <li className="flex items-center gap-2">
            <Share className="size-4 shrink-0" />
            Tocá el botón Compartir, abajo en Safari.
          </li>
          <li className="flex items-center gap-2">
            <SquarePlus className="size-4 shrink-0" />
            Elegí &ldquo;Agregar a pantalla de inicio&rdquo;.
          </li>
        </ol>
        <p className="mt-2 text-xs opacity-80">
          Apple no deja instalarla con un botón, y los avisos push solo funcionan así. No es
          un problema de la app.
        </p>
      </Card>
    );
  }

  return null;
}
