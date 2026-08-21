"use client";

import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Tilde redondo.
 *
 * Redondo y no cuadrado por coherencia con el resto del lenguaje visual, pero
 * también porque un círculo vacío se lee como "esto está esperando a alguien",
 * mientras que un cuadrado vacío se lee como un campo de formulario.
 *
 * El área táctil es de 44px aunque el círculo dibujado mida 24: se tilda
 * caminando, con una mano, mirando otra cosa.
 */
export function CircleCheckbox({
  checked,
  label,
  className,
  size = "md",
  ...props
}: Omit<React.ComponentProps<"button">, "type"> & {
  checked: boolean;
  /** Va al aria-label: "Marcar X como hecho". */
  label: string;
  size?: "sm" | "md";
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      className={cn(
        "grid shrink-0 place-items-center",
        size === "sm" ? "size-9" : "size-11",
        className,
      )}
      {...props}
    >
      <span
        className={cn(
          "grid place-items-center rounded-full border-2 transition-colors",
          size === "sm" ? "size-5" : "size-6",
          checked
            ? "border-success bg-success text-white"
            : "border-border-strong text-transparent",
        )}
      >
        <Check className={cn("stroke-[3]", size === "sm" ? "size-3" : "size-4")} />
      </span>
    </button>
  );
}
