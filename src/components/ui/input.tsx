import { cn } from "@/lib/utils";

/**
 * `text-base` y no `text-sm`: Safari en iPhone hace zoom automático sobre
 * cualquier input de menos de 16px al enfocarlo, y la pantalla queda corrida.
 */
export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "h-12 w-full rounded-app border border-border bg-surface px-3 text-base text-fg",
        "placeholder:text-muted focus-visible:border-primary focus-visible:outline-none",
        "disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(
        "w-full rounded-app border border-border bg-surface p-3 text-base text-fg",
        "placeholder:text-muted focus-visible:border-primary focus-visible:outline-none",
        className,
      )}
      {...props}
    />
  );
}

export function Label({ className, ...props }: React.ComponentProps<"label">) {
  return (
    <label className={cn("mb-1.5 block text-sm font-medium text-muted", className)} {...props} />
  );
}
