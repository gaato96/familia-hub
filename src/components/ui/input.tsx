import { cn } from "@/lib/utils";

/**
 * Campos con fondo tintado en vez de blanco sobre blanco.
 *
 * Sobre una tarjeta blanca, un input blanco con borde gris es invisible hasta
 * que se lo busca. Un fondo apenas más oscuro dice "acá se escribe" sin
 * necesidad del borde, y el borde queda libre para significar foco.
 *
 * `text-base` y no `text-sm`: Safari en iPhone hace zoom automático sobre
 * cualquier input de menos de 16px al enfocarlo, y la pantalla queda corrida.
 */
const FIELD = [
  "w-full rounded-app-sm border-2 border-transparent bg-surface-2 text-base text-fg",
  "placeholder:text-muted/70",
  "focus-visible:border-primary focus-visible:bg-surface focus-visible:outline-none",
  "transition-colors disabled:opacity-50",
].join(" ");

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return <input className={cn(FIELD, "h-12 px-3.5", className)} {...props} />;
}

export function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return <textarea className={cn(FIELD, "p-3.5", className)} {...props} />;
}

export function Select({ className, ...props }: React.ComponentProps<"select">) {
  return <select className={cn(FIELD, "h-12 px-3", className)} {...props} />;
}

export function Label({ className, ...props }: React.ComponentProps<"label">) {
  return (
    <label
      className={cn("mb-1.5 block text-sm font-bold text-muted", className)}
      {...props}
    />
  );
}
