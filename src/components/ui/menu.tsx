"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { MoreVertical } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Menú de tres puntitos.
 *
 * Radix ya resuelve lo aburrido y lo difícil: foco atrapado, Escape, tocar
 * afuera, flechas del teclado y no salirse de la pantalla. Lo que agrega este
 * archivo es solamente la piel, para que los diez menús de la app sean el
 * mismo menú.
 */
export const Menu = DropdownMenu.Root;

export function MenuTrigger({
  label = "Más opciones",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <DropdownMenu.Trigger
      aria-label={label}
      className={cn(
        "grid size-9 shrink-0 place-items-center rounded-full text-muted",
        "transition-colors hover:bg-surface-2 hover:text-fg",
        className,
      )}
    >
      <MoreVertical className="size-4" />
    </DropdownMenu.Trigger>
  );
}

export function MenuContent({
  children,
  align = "end",
}: {
  children: React.ReactNode;
  align?: "start" | "center" | "end";
}) {
  return (
    <DropdownMenu.Portal>
      <DropdownMenu.Content
        align={align}
        sideOffset={4}
        className={cn(
          "z-50 min-w-44 overflow-hidden rounded-app-sm bg-surface p-1.5 shadow-float",
          "data-[state=open]:animate-in data-[state=closed]:animate-out",
          "data-[state=open]:fade-in data-[state=closed]:fade-out",
          "data-[state=open]:zoom-in-95",
        )}
      >
        {children}
      </DropdownMenu.Content>
    </DropdownMenu.Portal>
  );
}

export function MenuItem({
  className,
  danger,
  ...props
}: React.ComponentProps<typeof DropdownMenu.Item> & { danger?: boolean }) {
  return (
    <DropdownMenu.Item
      className={cn(
        "flex cursor-pointer items-center gap-2.5 rounded-app-sm px-3 py-2.5 text-sm font-semibold",
        "outline-none data-[highlighted]:bg-surface-2",
        "[&_svg]:size-4 [&_svg]:shrink-0",
        danger ? "text-danger" : "text-fg",
        className,
      )}
      {...props}
    />
  );
}

export function MenuSeparator() {
  return <DropdownMenu.Separator className="my-1 h-px bg-border" />;
}
