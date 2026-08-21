import { cn } from "@/lib/utils";

/**
 * Encabezado de pantalla. Título, bajada y acciones.
 *
 * En escritorio las acciones van a la derecha del título, en la misma línea;
 * en el teléfono bajan y se estiran a ancho completo, porque un botón de 90px
 * arriba a la derecha es el peor lugar posible para el pulgar.
 */
export function PageHeader({
  title,
  subtitle,
  actions,
  className,
}: {
  title: string;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("mb-5 flex flex-wrap items-end justify-between gap-3", className)}>
      <div className="min-w-0">
        <h1 className="font-display text-2xl font-bold tracking-tight text-fg lg:text-3xl">
          {title}
        </h1>
        {subtitle ? <p className="mt-0.5 text-sm text-muted">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  );
}
