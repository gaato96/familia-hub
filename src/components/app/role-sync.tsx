"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

import { createClient } from "@/lib/supabase/client";

/**
 * Vuelve a emitir el token cuando el rol del JWT quedó viejo.
 *
 * El rol viaja DENTRO del access token: lo estampa `custom_access_token_hook`
 * en el momento de emitirlo. Cuando un adulto promueve a alguien,
 * `set_member_role()` cambia la fila de `profiles` pero el token que esa
 * persona tiene en la mano sigue diciendo `child` — así que la barra lateral
 * le esconde Finanzas y Documentos, y RLS le devuelve cero filas del
 * expediente. Se arreglaba solo recién cuando el token vencía, o cerrando
 * sesión y volviendo a entrar.
 *
 * Es el mismo problema que ya obligaba a llamar `refreshSession()` después de
 * `create_family` / `join_family` (ver src/lib/auth/onboarding.ts). Acá se
 * resuelve igual, pero sin que nadie tenga que enterarse: si la fila y el
 * claim no coinciden, se pide un token nuevo y se vuelve a renderizar.
 *
 * **Corre una sola vez por montaje, a propósito.** `router.refresh()` vuelve a
 * ejecutar los componentes de servidor pero NO desmonta este componente, así
 * que el ref sobrevive: si el refresh no arregla la diferencia —el caso real
 * es el hook de Supabase deshabilitado en el Dashboard— no se entra en un
 * bucle de refrescos.
 */
export function RoleSync({ stale }: { stale: boolean }) {
  const router = useRouter();
  const attempted = useRef(false);

  useEffect(() => {
    if (!stale || attempted.current) return;
    attempted.current = true;

    // setState no hay: esto es un efecto de red seguido de un refresh del
    // router, que es lo que `react-hooks/set-state-in-effect` no prohíbe.
    void createClient()
      .auth.refreshSession()
      .then(({ error }) => {
        if (!error) router.refresh();
      });
  }, [stale, router]);

  return null;
}
