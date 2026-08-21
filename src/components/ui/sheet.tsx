"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * El contenedor de TODOS los formularios de la app. Cambia de forma según la
 * pantalla, y no por gusto:
 *
 * - **Teléfono**: hoja que sube desde abajo. Un modal centrado deja los campos
 *   arriba y el teclado los tapa; la hoja los deja pegados al pulgar.
 * - **Escritorio** (`lg`): diálogo centrado. Una hoja pegada al borde inferior
 *   de un monitor de 27" obliga a mirar abajo del todo mientras el mouse está
 *   en el medio, y deja 800px de pantalla vacía arriba.
 *
 * Es el mismo componente porque es el mismo formulario: duplicarlo garantiza
 * que dentro de tres meses el de escritorio no tenga el campo nuevo.
 */

export const Sheet = Dialog.Root;
export const SheetTrigger = Dialog.Trigger;
export const SheetClose = Dialog.Close;

export function SheetContent({
  title,
  description,
  children,
  className,
  /** `wide` para pantallas con dos columnas adentro (recetas, expediente). */
  size = "md",
}: {
  title: string;
  /** Opcional en pantalla, obligatorio para lectores de pantalla. */
  description?: string;
  children: React.ReactNode;
  className?: string;
  size?: "md" | "wide";
}) {
  return (
    <Dialog.Portal>
      <Dialog.Overlay
        className={cn(
          "fixed inset-0 z-50 bg-[#1a0f0a]/45 backdrop-blur-[2px]",
          "data-[state=open]:animate-in data-[state=closed]:animate-out",
          "data-[state=open]:fade-in data-[state=closed]:fade-out",
        )}
      />
      <Dialog.Content
        className={cn(
          "fixed z-50 overflow-y-auto bg-surface thin-scroll",
          // Teléfono: hoja inferior a ancho completo.
          "inset-x-0 bottom-0 max-h-[92dvh] rounded-t-3xl",
          "px-4 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] pt-3",
          "data-[state=open]:animate-in data-[state=closed]:animate-out",
          "data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom",
          // Escritorio: diálogo centrado.
          "lg:inset-auto lg:bottom-auto lg:left-1/2 lg:top-1/2 lg:max-h-[85dvh]",
          "lg:-translate-x-1/2 lg:-translate-y-1/2 lg:rounded-app-lg lg:p-6 lg:shadow-float",
          "lg:data-[state=open]:zoom-in-95 lg:data-[state=closed]:zoom-out-95",
          "lg:data-[state=open]:slide-in-from-bottom-0 lg:data-[state=closed]:slide-out-to-bottom-0",
          size === "wide" ? "lg:w-[44rem]" : "lg:w-[30rem]",
          className,
        )}
      >
        {/* Agarradera: le dice al pulgar que esto se puede bajar. En escritorio
            no significa nada, así que no está. */}
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-border-strong lg:hidden" />

        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <Dialog.Title className="font-display text-xl font-bold text-fg">
              {title}
            </Dialog.Title>
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
            className="-mr-1 -mt-1 grid size-9 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-fg"
          >
            <X className="size-5" />
          </Dialog.Close>
        </div>

        {children}
      </Dialog.Content>
    </Dialog.Portal>
  );
}
