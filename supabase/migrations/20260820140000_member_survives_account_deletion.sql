-- ===========================================================================
-- Borrar una cuenta no puede romper la base.
--
-- El bug: `family_members.profile_id` es `on delete set null`, pero el CHECK
-- `family_members_kind_matches_profile` exige que un `kind = 'user'` tenga
-- profile_id. Al borrar el usuario de auth, la cascada pone profile_id en null
-- y el CHECK rebota el UPDATE — así que el DELETE entero falla con un
-- "Database error deleting user" que no dice nada.
--
-- Consecuencia real, más allá del seed: no se podía eliminar la cuenta de
-- nadie. Nunca.
--
-- La corrección modela lo que de verdad pasa: cuando alguien pierde el login,
-- su ficha de integrante SOBREVIVE. Tiene que sobrevivir — de ella cuelgan las
-- tareas que hizo, su expediente y sus talles. Lo único que cambia es que ya
-- no puede iniciar sesión, que es exactamente la definición de `dependent`.
--
-- Se hace con un trigger BEFORE UPDATE y no relajando el CHECK: la invariante
-- "un integrante o tiene cuenta o no la tiene" es la que hace que el resto del
-- modelo sea legible, y conviene conservarla.
-- ===========================================================================

create or replace function public.family_members_demote_on_account_loss()
returns trigger
language plpgsql
as $$
begin
  -- Corre también cuando la cascada del FK hace el SET NULL: una acción
  -- referencial es un UPDATE normal y dispara los triggers de fila.
  if new.profile_id is null and new.kind = 'user' then
    new.kind := 'dependent';
  end if;
  return new;
end;
$$;

create trigger family_members_demote_on_account_loss
  before update on public.family_members
  for each row execute function public.family_members_demote_on_account_loss();
