-- ===========================================================================
-- Esquema core: familias, usuarios e integrantes.
--
-- Distinción central del modelo: `profiles` es "alguien que puede iniciar
-- sesión"; `family_members` es "alguien que vive en esta casa". Julián no
-- tiene cuenta pero sí expediente, talles y tareas asignadas, así que TODO lo
-- que pertenece a una persona apunta a `family_members`, nunca a `profiles`.
-- ===========================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Utilidad compartida: mantener updated_at sin repetir el trigger en cada tabla
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- families — el tenant
-- ---------------------------------------------------------------------------
create table public.families (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(trim(name)) between 1 and 60),
  -- 6 caracteres, sin I/O/0/1 para que se pueda dictar por teléfono sin dudas.
  invite_code text not null unique check (invite_code ~ '^[A-HJ-NP-Z2-9]{6}$'),
  timezone    text not null default 'America/Argentina/Buenos_Aires',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger families_updated_at
  before update on public.families
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- profiles — un usuario con login, atado a una familia
--
-- Solo lleva lo que decide PERMISOS. El nombre, el color y la foto viven en
-- family_members, para que un integrante sin cuenta los tenga igual.
-- ---------------------------------------------------------------------------
create table public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  family_id  uuid references public.families(id) on delete cascade,
  role       text not null default 'parent' check (role in ('parent', 'child')),
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index profiles_family_id_idx on public.profiles (family_id);

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- family_members — toda persona de la casa
-- ---------------------------------------------------------------------------
create table public.family_members (
  id           uuid primary key default gen_random_uuid(),
  family_id    uuid not null references public.families(id) on delete cascade,
  -- null para un dependiente (un nene sin cuenta propia).
  profile_id   uuid unique references public.profiles(id) on delete set null,
  kind         text not null default 'dependent' check (kind in ('user', 'dependent')),
  display_name text not null check (length(trim(display_name)) between 1 and 40),
  avatar_path  text,
  color        text not null default '#6366F1' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  birth_date   date,
  position     integer not null default 0,
  is_archived  boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  -- Un 'user' sin profile_id sería un integrante que nadie puede usar; un
  -- 'dependent' con profile_id sería una cuenta disfrazada de dependiente.
  constraint family_members_kind_matches_profile check (
    (kind = 'user' and profile_id is not null)
    or (kind = 'dependent' and profile_id is null)
  )
);

create index family_members_family_id_idx on public.family_members (family_id);

create trigger family_members_updated_at
  before update on public.family_members
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- push_subscriptions — un registro por navegador/dispositivo
-- ---------------------------------------------------------------------------
create table public.push_subscriptions (
  id           uuid primary key default gen_random_uuid(),
  family_id    uuid not null references public.families(id) on delete cascade,
  profile_id   uuid not null references public.profiles(id) on delete cascade,
  endpoint     text not null unique,
  p256dh       text not null,
  auth         text not null,
  user_agent   text,
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index push_subscriptions_profile_id_idx on public.push_subscriptions (profile_id);
