import { cn } from "@/lib/utils";

/**
 * Tarjeta: superficie blanca, esquinas redondas, sombra difusa y —clave— SIN
 * borde por defecto.
 *
 * La versión anterior le ponía un borde gris a todo. Con veinte tarjetas en
 * pantalla eso no genera jerarquía: genera una grilla de rectángulos iguales.
 * Acá la separación la hace la sombra, y el borde queda reservado para las
 * tarjetas que avisan algo (`tone`).
 */
const TONES = {
  plain: "bg-surface shadow-card",
  primary: "bg-primary-soft text-primary-soft-fg",
  info: "bg-secondary-soft text-secondary-soft-fg",
  success: "bg-success-soft text-success-soft-fg",
  warning: "bg-warning-soft text-warning-soft-fg",
  danger: "bg-danger-soft text-danger-soft-fg",
  /** Hundida, no apoyada: el expediente y la caja fuerte. */
  vault: "bg-surface-2 shadow-vault",
} as const;

export type CardTone = keyof typeof TONES;

export function Card({
  className,
  tone = "plain",
  ...props
}: React.ComponentProps<"div"> & { tone?: CardTone }) {
  return <div className={cn("rounded-app p-4", TONES[tone], className)} {...props} />;
}

/**
 * Encabezado de sección: el título a la izquierda y, opcionalmente, una acción
 * a la derecha. Se repite en todas las pantallas, así que vive acá y no
 * copiado quince veces.
 */
export function SectionHeading({
  icon,
  title,
  count,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  count?: number;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-2.5 flex items-center gap-2", className)}>
      {icon ? <span className="text-secondary [&_svg]:size-5">{icon}</span> : null}
      <h2 className="font-display text-base font-bold text-fg">{title}</h2>
      {count !== undefined ? (
        <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs font-bold text-muted">
          {count}
        </span>
      ) : null}
      {action ? <div className="ml-auto">{action}</div> : null}
    </div>
  );
}

export function CardTitle({ className, ...props }: React.ComponentProps<"h2">) {
  return (
    <h2 className={cn("font-display text-sm font-bold text-muted", className)} {...props} />
  );
}

/** Estado vacío: siempre dice qué hacer, no solo que no hay nada. */
export function EmptyState({
  icon,
  title,
  hint,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  hint?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-2 rounded-app border border-dashed border-border-strong",
        "bg-surface/50 px-6 py-10 text-center",
        className,
      )}
    >
      {icon ? (
        <div className="mb-1 grid size-12 place-items-center rounded-full bg-surface-2 text-muted [&_svg]:size-6">
          {icon}
        </div>
      ) : null}
      <p className="font-display text-base font-bold text-fg">{title}</p>
      {hint ? <p className="max-w-xs text-sm text-muted">{hint}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
