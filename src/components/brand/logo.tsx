import { APP_NAME } from "@/lib/brand";
import { cn } from "@/lib/utils";

/**
 * El nido visto un poco desde arriba: el aro, el hueco y tres huevos adentro.
 *
 * El hueco es un agujero REAL (`fillRule="evenodd"` sobre un solo path, no dos
 * formas superpuestas), y todo se dibuja con `currentColor`. Las dos cosas
 * juntas son lo que hace que el mismo dibujo funcione sobre cualquier fondo —
 * el ícono de la PWA sobre terracota, la barra lateral sobre blanco, un botón—
 * sin tener que pintar ninguna pieza del color del fondo de atrás.
 *
 * Los huevos van separados y no pegados: superpuestos se fusionan en una sola
 * mancha, y abajo de 40px deja de leerse que son tres.
 */
export function NidoMark({ className, ...props }: React.ComponentProps<"svg">) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={cn("size-6", className)}
      {...props}
    >
      <path
        fill="currentColor"
        fillRule="evenodd"
        clipRule="evenodd"
        d="M2.4 13.2A9.6 5.4 0 0 1 21.6 13.2C21.6 17.7 17.3 21 12 21S2.4 17.7 2.4 13.2ZM12 9.75c-3.37 0-6.1 1.5-6.1 3.15S8.63 16.05 12 16.05s6.1-1.5 6.1-3.15S15.37 9.75 12 9.75Z"
      />
      <g fill="currentColor" opacity="0.82">
        <ellipse cx="9.25" cy="13.3" rx="1.3" ry="1.55" />
        <ellipse cx="12" cy="12.3" rx="1.3" ry="1.55" />
        <ellipse cx="14.75" cy="13.3" rx="1.3" ry="1.55" />
      </g>
    </svg>
  );
}

/** Marca sobre pastilla terracota. Es el avatar de la app en la barra. */
export function NidoBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "grid size-9 shrink-0 place-items-center rounded-app-sm bg-primary text-primary-fg shadow-press",
        className,
      )}
    >
      <NidoMark className="size-5" />
    </span>
  );
}

export function Wordmark({
  className,
  showTagline = false,
}: {
  className?: string;
  showTagline?: boolean;
}) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <NidoBadge />
      <span className="min-w-0">
        <span className="block font-display text-lg font-bold leading-tight tracking-tight text-fg">
          {APP_NAME}
        </span>
        {showTagline ? (
          <span className="block truncate text-xs text-muted">
            Todo lo de casa, en un solo lugar
          </span>
        ) : null}
      </span>
    </span>
  );
}
