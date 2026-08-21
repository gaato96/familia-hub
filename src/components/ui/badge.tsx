import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Pastilla de estado. Reemplaza a los quince `<span className="rounded-full
 * bg-...">` sueltos que había repartidos por las pantallas: son todos lo
 * mismo, y tenerlos sueltos garantizaba que no siguieran siendo lo mismo.
 */
const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full font-semibold [&_svg]:size-3",
  {
    variants: {
      tone: {
        neutral: "bg-surface-2 text-muted",
        primary: "bg-primary-soft text-primary-soft-fg",
        info: "bg-secondary-soft text-secondary-soft-fg",
        success: "bg-success-soft text-success-soft-fg",
        warning: "bg-warning-soft text-warning-soft-fg",
        danger: "bg-danger-soft text-danger-soft-fg",
      },
      size: {
        sm: "px-2 py-0.5 text-[11px]",
        md: "px-2.5 py-1 text-xs",
      },
    },
    defaultVariants: { tone: "neutral", size: "sm" },
  },
);

export function Badge({
  className,
  tone,
  size,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone, size }), className)} {...props} />;
}

/**
 * Pastilla seleccionable — categorías, colores, filtros. Usa `aria-pressed`
 * y no un radio escondido porque casi siempre son filtros, no un formulario.
 */
export function ChoiceChip({
  selected,
  className,
  ...props
}: React.ComponentProps<"button"> & { selected: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        "rounded-full px-3.5 py-2 text-xs font-bold transition-colors",
        selected
          ? "bg-primary text-primary-fg shadow-press"
          : "bg-surface-2 text-muted hover:bg-surface-3 hover:text-fg",
        className,
      )}
      {...props}
    />
  );
}
