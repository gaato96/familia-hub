"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Hoja inferior. Es el contenedor de TODOS los formularios de la app.
 *
 * En un teléfono, un modal centrado deja los campos arriba y el teclado los
 * tapa; una hoja que sube desde abajo deja el contenido pegado al pulgar y al
 * teclado. Se usa esto en lugar de páginas nuevas para no perder el contexto
 * de lo que se estaba mirando.
 */

export const Sheet = Dialog.Root;
export const SheetTrigger = Dialog.Trigger;
export const SheetClose = Dialog.Close;

export function SheetContent({
  title,
  description,
  children,
  className,
}: {
  title: string;
  /** Opcional en pantalla, obligatorio para lectores de pantalla. */
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in data-[state=closed]:fade-out" />
      <Dialog.Content
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 max-h-[92dvh] overflow-y-auto",
          "rounded-t-3xl border-t border-border bg-surface",
          // El padding de abajo suma la barra de gestos: sin esto, el botón de
          // guardar queda medio tapado en un iPhone.
          "px-4 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] pt-3",
          "data-[state=open]:animate-in data-[state=closed]:animate-out",
          "data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom",
          className,
        )}
      >
        {/* Agarradera: le dice al pulgar que esto se puede bajar. */}
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-border" />

        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <Dialog.Title className="text-lg font-bold text-fg">{title}</Dialog.Title>
            {description ? (
              <Dialog.Description className="mt-0.5 text-sm text-muted">
                {description}
              </Dialog.Description>
            ) : (
              <Dialog.Description className="sr-only">{title}</Dialog.Description>
            )}
          </div>
          <Dialog.Close
            aria-label="Cerrar"
            className="-mr-1 -mt-1 grid size-9 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-2"
          >
            <X className="size-5" />
          </Dialog.Close>
        </div>

        {children}
      </Dialog.Content>
    </Dialog.Portal>
  );
}
