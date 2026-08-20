import { Home } from "lucide-react";

import { OnboardingForm } from "@/components/auth/onboarding-form";

export const metadata = { title: "Bienvenido" };

export default function BienvenidaPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-8 px-5 py-12">
      <header className="flex flex-col items-center gap-3 text-center">
        <div className="grid size-14 place-items-center rounded-2xl bg-primary text-primary-fg">
          <Home className="size-7" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-fg">Una cosa más</h1>
          <p className="mt-1 text-sm text-muted">
            Creá el grupo de tu familia, o entrá al que ya existe con el código que te pasaron.
          </p>
        </div>
      </header>

      <OnboardingForm />
    </main>
  );
}
