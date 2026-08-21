import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Botones con forma de pastilla.
 *
 * Los tamaños arrancan en 44px de alto (`h-11`) porque es el mínimo que se
 * acierta con el pulgar sin mirar. Todo lo que se toca en la calle — tildar la
 * compra, marcar una tarea — usa `lg`.
 *
 * `rounded-full` en vez de esquinas suaves: en un lenguaje visual donde TODO
 * es redondeado, la pastilla completa es lo único que sigue distinguiendo un
 * botón de una tarjeta. Cuando el botón crece a ancho completo la pastilla se
 * mantiene, que es justo lo que lo hace verse como un botón y no como otra
 * fila más de la lista.
 */
const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full",
    "font-display text-sm font-bold tracking-tight",
    "transition-[transform,box-shadow,background-color,color] duration-150",
    "disabled:pointer-events-none disabled:opacity-50",
    "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
    "active:scale-[0.97]",
  ],
  {
    variants: {
      variant: {
        primary:
          "bg-primary text-primary-fg shadow-press hover:shadow-float hover:brightness-110",
        /* Contorno azul de 2px: el "no, esta otra cosa" del sistema. */
        secondary:
          "border-2 border-secondary bg-transparent text-secondary hover:bg-secondary-soft",
        /* Relleno suave: acciones frecuentes que no deberían competir con la
           acción principal de la pantalla. */
        soft: "bg-primary-soft text-primary-soft-fg hover:brightness-95",
        outline:
          "border border-border-strong bg-surface text-fg shadow-press hover:bg-surface-2",
        ghost: "text-muted hover:bg-surface-2 hover:text-fg",
        danger: "bg-danger text-white shadow-press hover:brightness-110",
      },
      size: {
        sm: "h-9 px-3.5",
        md: "h-11 px-5",
        lg: "h-13 px-6 text-base",
        icon: "size-11",
        "icon-sm": "size-9",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean };

export function Button({ className, variant, size, asChild, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}

/**
 * Botón flotante. En el teléfono se apoya sobre la bottom nav; en escritorio
 * queda abajo a la derecha del contenido.
 */
export function Fab({ className, ...props }: React.ComponentProps<"button">) {
  return (
    <button
      className={cn(
        "fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] right-4 z-30 lg:bottom-8 lg:right-8",
        "grid size-14 place-items-center rounded-full bg-primary text-primary-fg",
        "shadow-float transition-transform active:scale-95 hover:brightness-110",
        "[&_svg]:size-6",
        className,
      )}
      {...props}
    />
  );
}

export { buttonVariants };
