import { Home } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-8 px-5 py-12">
      <header className="flex flex-col items-center gap-3 text-center">
        <div className="grid size-14 place-items-center rounded-2xl bg-primary text-primary-fg">
          <Home className="size-7" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-fg">Casa</h1>
          <p className="mt-1 text-sm text-muted">Todo lo de la familia, en un solo lugar.</p>
        </div>
      </header>
      {children}
    </main>
  );
}
