import { cn } from "@/lib/utils";

/**
 * Anillo de progreso. Se usa donde el número importa tanto como la sensación
 * de avance: "la casa hoy", el avance de un objetivo.
 *
 * SVG y no un canvas ni una librería: es un `stroke-dasharray` y un
 * `stroke-dashoffset`, y así funciona igual en el render del servidor.
 */
export function ProgressRing({
  value,
  size = 56,
  stroke = 6,
  className,
  label,
}: {
  /** 0 a 1. */
  value: number;
  size?: number;
  stroke?: number;
  className?: string;
  label?: string;
}) {
  const clamped = Math.max(0, Math.min(1, value));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const percent = Math.round(clamped * 100);

  return (
    <div
      className={cn("relative shrink-0", className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={label ?? `${percent} por ciento`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          className="stroke-surface-3"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - clamped)}
          className={cn(
            "transition-[stroke-dashoffset] duration-500",
            clamped >= 1 ? "stroke-success" : "stroke-primary",
          )}
        />
      </svg>
      <span
        className={cn(
          "absolute inset-0 grid place-items-center font-display font-bold",
          size >= 56 ? "text-sm" : "text-[11px]",
          clamped >= 1 ? "text-success" : "text-fg",
        )}
      >
        {percent}%
      </span>
    </div>
  );
}

/** Barra de progreso lineal, para cuando no hay lugar para el anillo. */
export function ProgressBar({
  value,
  className,
  tone = "primary",
}: {
  /** 0 a 1. */
  value: number;
  className?: string;
  tone?: "primary" | "success" | "info";
}) {
  const clamped = Math.max(0, Math.min(1, value));

  return (
    <div
      className={cn("h-2 w-full overflow-hidden rounded-full bg-surface-3", className)}
      role="progressbar"
      aria-valuenow={Math.round(clamped * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={cn(
          "h-full rounded-full transition-[width] duration-500",
          tone === "success" && "bg-success",
          tone === "info" && "bg-secondary",
          tone === "primary" && "bg-primary",
        )}
        style={{ width: `${clamped * 100}%` }}
      />
    </div>
  );
}
