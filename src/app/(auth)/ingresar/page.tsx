import Link from "next/link";
import { Suspense } from "react";

import { AuthForm } from "@/components/auth/auth-form";

export const metadata = { title: "Entrar" };

export default function IngresarPage() {
  return (
    <div className="space-y-6">
      {/* AuthForm lee ?next= con useSearchParams, que exige un límite de Suspense. */}
      <Suspense fallback={<div className="h-64" />}>
        <AuthForm mode="signin" />
      </Suspense>

      <p className="text-center text-sm text-muted">
        ¿Todavía no tenés cuenta?{" "}
        <Link href="/registro" className="font-semibold text-primary">
          Crear una
        </Link>
      </p>
    </div>
  );
}
