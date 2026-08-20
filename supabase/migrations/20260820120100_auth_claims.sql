-- ===========================================================================
-- Resolución del tenant vía claims del JWT.
--
-- Por qué no leer `profiles` dentro de cada policy: cuesta una subconsulta por
-- fila evaluada y, sobre `profiles` misma, recursa. En cambio un Custom Access
-- Token Hook estampa family_id y el rol en el JWT al iniciar sesión, y cada
-- policy los lee gratis.
--
-- El claim se llama `user_role`, NO `role`. PostgREST reserva el claim `role`
-- para elegir el rol de Postgres con el que conecta — poner 'parent' ahí
-- intentaría un SET ROLE parent y rompería todas las requests.
--
-- IMPORTANTE: después de aplicar esta migración hay que habilitar el hook a
-- mano en el Dashboard → Authentication → Hooks → Custom Access Token.
-- Si no, todos los usuarios ven todo vacío y no hay error visible.
-- ===========================================================================

create or replace function public.auth_family_id()
returns uuid
language sql
stable
as $$
  select nullif(auth.jwt() ->> 'family_id', '')::uuid;
$$;

create or replace function public.auth_user_role()
returns text
language sql
stable
as $$
  select coalesce(auth.jwt() ->> 'user_role', '');
$$;

/** Los padres son los administradores: configuran, ven finanzas y expedientes. */
create or replace function public.is_parent()
returns boolean
language sql
stable
as $$
  select coalesce(auth.jwt() ->> 'user_role', '') = 'parent';
$$;

/** Cualquier integrante con sesión activa dentro de una familia. */
create or replace function public.is_member()
returns boolean
language sql
stable
as $$
  select nullif(auth.jwt() ->> 'family_id', '') is not null
     and coalesce(auth.jwt() ->> 'user_role', '') in ('parent', 'child');
$$;

-- ---------------------------------------------------------------------------
-- El hook. Corre como supabase_auth_admin en cada emisión/refresh de token.
-- ---------------------------------------------------------------------------
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_claims    jsonb;
  v_family_id uuid;
  v_role      text;
  v_is_active boolean;
begin
  select p.family_id, p.role, p.is_active
    into v_family_id, v_role, v_is_active
  from public.profiles p
  where p.id = (event ->> 'user_id')::uuid;

  v_claims := coalesce(event -> 'claims', '{}'::jsonb);

  -- Un usuario desactivado conserva una sesión válida de Supabase pero pierde
  -- los claims, así que ninguna policy de tenant matchea y no ve nada.
  -- Un usuario recién registrado que todavía no creó ni se unió a una familia
  -- cae en la misma rama: sesión sí, datos no, hasta que elija.
  if v_role is null or v_is_active is not true or v_family_id is null then
    v_claims := jsonb_set(v_claims, '{user_role}', to_jsonb(''::text));
    v_claims := jsonb_set(v_claims, '{family_id}', 'null'::jsonb);
  else
    v_claims := jsonb_set(v_claims, '{user_role}', to_jsonb(v_role));
    v_claims := jsonb_set(v_claims, '{family_id}', to_jsonb(v_family_id::text));
  end if;

  return jsonb_set(event, '{claims}', v_claims);
end;
$$;

grant usage on schema public to supabase_auth_admin;
grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook(jsonb)
  from authenticated, anon, public;
grant select on public.profiles to supabase_auth_admin;

-- ---------------------------------------------------------------------------
-- Alta de usuario: todo usuario nuevo arranca con un profile sin familia.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
