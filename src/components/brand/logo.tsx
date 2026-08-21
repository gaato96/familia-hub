import { APP_NAME } from "@/lib/brand";
import { cn } from "@/lib/utils";

/**
 * El nido del hornero: una cúpula de barro sobre una rama, con la entrada
 * lateral en arco.
 *
 * Se dibuja con `fill-rule="evenodd"` y no con dos formas superpuestas para
 * que la entrada sea un agujero REAL: así el mismo path funciona sobre
 * cualquier fondo —el ícono de la PWA, un botón, la barra lateral— sin que
 * haya que pintar la puerta del color del fondo de atrás.
 */
export function HorneroMark({
  className,
  ...props
}: React.ComponentProps<"svg">) {
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
        d="M12 3a8.5 8.5 0 0 1 8.5 8.5V19a1 1 0 0 1-1 1H4.5a1 1 0 0 1-1-1v-7.5A8.5 8.5 0 0 1 12 3Zm2.75 9.25A3.25 3.25 0 0 0 11.5 15.5V20h6.5v-4.5a3.25 3.25 0 0 0-3.25-3.25Z"
      />
      {/* La rama. Corta, no cruza todo el ancho: un nido de hornero está
          apoyado en el extremo de una rama, no colgado del medio. */}
      <path
        fill="currentColor"
        d="M2.75 20.5h18.5a.9.9 0 0 1 0 1.8H2.75a.9.9 0 0 1 0-1.8Z"
        opacity="0.45"
      />
    </svg>
  );
}

/** Marca sobre pastilla terracota. Es el avatar de la app en la barra. */
export function HorneroBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "grid size-9 shrink-0 place-items-center rounded-app-sm bg-primary text-primary-fg shadow-press",
        className,
      )}
    >
      <HorneroMark className="size-5" />
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
      <HorneroBadge />
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
