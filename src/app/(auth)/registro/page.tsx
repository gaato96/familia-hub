import Link from "next/link";
import { Suspense } from "react";

import { AuthForm } from "@/components/auth/auth-form";

export const metadata = { title: "Crear cuenta" };

export default function RegistroPage() {
  return (
    <div className="space-y-6">
      <Suspense fallback={<div className="h-64" />}>
        <AuthForm mode="signup" />
      </Suspense>

      <p className="text-center text-sm text-muted">
        ¿Ya tenés cuenta?{" "}
        <Link href="/ingresar" className="font-semibold text-primary">
          Entrar
        </Link>
      </p>
    </div>
  );
}
