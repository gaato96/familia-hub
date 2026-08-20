-- ===========================================================================
-- Alta de familia y de integrantes.
--
-- Crear una familia es un problema del huevo y la gallina para RLS: el usuario
-- todavía no tiene claim `family_id`, así que ninguna policy puede autorizar
-- el INSERT. Se resuelve con funciones SECURITY DEFINER acotadas en vez de
-- abrir un INSERT libre sobre `families`.
-- ===========================================================================

/**
 * Código de 6 caracteres sin I, O, 0 ni 1: se dicta por teléfono sin que nadie
 * pregunte "¿o de oso o cero?".
 */
create or replace function public.generate_invite_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code     text;
  v_i        integer;
begin
  loop
    v_code := '';
    for v_i in 1..6 loop
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.families where invite_code = v_code);
  end loop;
  return v_code;
end;
$$;

revoke execute on function public.generate_invite_code() from anon, authenticated, public;

/**
 * Crea la familia y deja al llamador como primer integrante, rol `parent`.
 *
 * Los claims del JWT se estampan al iniciar sesión, así que después de llamar
 * a esta función el token en mano TODAVÍA no tiene family_id. El cliente debe
 * hacer `supabase.auth.refreshSession()` antes de la primera lectura, o va a
 * ver todo vacío. Ver src/lib/auth/onboarding.ts.
 */
create or replace function public.create_family(p_family_name text, p_display_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id   uuid := auth.uid();
  v_family_id uuid;
begin
  if v_user_id is null then
    raise exception 'No hay sesión activa';
  end if;

  if exists (select 1 from public.profiles where id = v_user_id and family_id is not null) then
    raise exception 'Ya pertenecés a una familia';
  end if;

  insert into public.families (name, invite_code)
  values (trim(p_family_name), public.generate_invite_code())
  returning id into v_family_id;

  insert into public.profiles (id, family_id, role, is_active)
  values (v_user_id, v_family_id, 'parent', true)
  on conflict (id) do update
    set family_id = excluded.family_id,
        role      = 'parent',
        is_active = true;

  insert into public.family_members (family_id, profile_id, kind, display_name, position)
  values (v_family_id, v_user_id, 'user', trim(p_display_name), 0);

  return v_family_id;
end;
$$;

/**
 * Suma al llamador a una familia existente usando el código de invitación.
 *
 * Entra SIEMPRE como `child`, nunca como `parent`, aunque sea el otro adulto
 * de la pareja: si el rol viniera del que se une, cualquier hijo con el código
 * se auto-promovería a administrador. Un `parent` lo asciende con un toque
 * desde Ajustes → Integrantes. Es un toque de más a cambio de que el permiso
 * más alto de la app nunca sea auto-asignable.
 */
create or replace function public.join_family(p_invite_code text, p_display_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id   uuid := auth.uid();
  v_family_id uuid;
begin
  if v_user_id is null then
    raise exception 'No hay sesión activa';
  end if;

  if exists (select 1 from public.profiles where id = v_user_id and family_id is not null) then
    raise exception 'Ya pertenecés a una familia';
  end if;

  select id into v_family_id
  from public.families
  where invite_code = upper(trim(p_invite_code));

  if v_family_id is null then
    raise exception 'El código no corresponde a ninguna familia';
  end if;

  insert into public.profiles (id, family_id, role, is_active)
  values (v_user_id, v_family_id, 'child', true)
  on conflict (id) do update
    set family_id = excluded.family_id,
        role      = 'child',
        is_active = true;

  insert into public.family_members (family_id, profile_id, kind, display_name, position)
  values (
    v_family_id,
    v_user_id,
    'user',
    trim(p_display_name),
    coalesce((select max(position) + 1 from public.family_members where family_id = v_family_id), 0)
  );

  return v_family_id;
end;
$$;

/**
 * Cambia el rol de otro integrante. Solo un `parent`, y nunca sobre sí mismo:
 * si el único administrador se degrada por error, la familia queda sin nadie
 * que pueda volver a promoverlo.
 */
create or replace function public.set_member_role(p_profile_id uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_parent() then
    raise exception 'Solo un adulto puede cambiar roles';
  end if;

  if p_profile_id = auth.uid() then
    raise exception 'No podés cambiar tu propio rol';
  end if;

  if p_role not in ('parent', 'child') then
    raise exception 'Rol inválido';
  end if;

  update public.profiles
     set role = p_role
   where id = p_profile_id
     and family_id = public.auth_family_id();

  if not found then
    raise exception 'Ese integrante no pertenece a tu familia';
  end if;
end;
$$;

/** Renueva el código: sirve cuando se compartió de más y se quiere invalidar. */
create or replace function public.rotate_invite_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
begin
  if not public.is_parent() then
    raise exception 'Solo un adulto puede renovar el código';
  end if;

  v_code := public.generate_invite_code();

  update public.families
     set invite_code = v_code
   where id = public.auth_family_id();

  return v_code;
end;
$$;
