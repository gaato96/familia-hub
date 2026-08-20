import { cn } from "@/lib/utils";

export function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("rounded-app border border-border bg-surface p-4", className)}
      {...props}
    />
  );
}

export function CardTitle({ className, ...props }: React.ComponentProps<"h2">) {
  return <h2 className={cn("text-sm font-semibold text-muted", className)} {...props} />;
}

/** Estado vacío: siempre dice qué hacer, no solo que no hay nada. */
export function EmptyState({
  icon,
  title,
  hint,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-app border border-dashed border-border px-6 py-10 text-center">
      {icon ? <div className="text-muted">{icon}</div> : null}
      <p className="text-sm font-medium text-fg">{title}</p>
      {hint ? <p className="max-w-xs text-sm text-muted">{hint}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
