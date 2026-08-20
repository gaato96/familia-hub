import { WifiOff } from "lucide-react";

export const metadata = { title: "Sin conexión" };

/**
 * Lo que muestra el service worker cuando una navegación no llega a la red.
 *
 * Deliberadamente estática y sin datos: es la pantalla que tiene que abrir
 * cuando NADA anda, así que no puede depender de una lectura.
 */
export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="grid size-14 place-items-center rounded-2xl bg-surface-2 text-muted">
        <WifiOff className="size-7" />
      </div>
      <h1 className="text-xl font-bold text-fg">Sin conexión</h1>
      <p className="text-sm text-muted">
        No hay internet ahora mismo. Lo que hayas tildado sin señal se guarda y se sincroniza
        solo cuando vuelva.
      </p>
    </main>
  );
}
