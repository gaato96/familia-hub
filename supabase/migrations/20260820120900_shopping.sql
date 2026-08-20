-- ===========================================================================
-- Listas y compras.
--
-- Una sola pareja de tablas cubre las seis secciones del pedido (súper,
-- verdulería, farmacia, hogar, caprichos, regalos) porque todas son lo mismo:
-- una lista con ítems tildables. Lo que cambia es `kind` — que decide ícono,
-- color y orden — y, en las de regalo, a quién apuntan.
-- ===========================================================================

create table public.shopping_lists (
  id                 uuid primary key default gen_random_uuid(),
  family_id          uuid not null references public.families(id) on delete cascade,
  name               text not null check (length(trim(name)) between 1 and 60),
  kind               text not null default 'general'
                     check (kind in ('supermercado', 'verduleria', 'farmacia',
                                     'hogar', 'caprichos', 'regalos', 'general')),
  -- Solo para kind = 'regalos': de quién es la lista de deseos.
  gift_for_member_id uuid references public.family_members(id) on delete cascade,
  position           integer not null default 0,
  is_archived        boolean not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  constraint shopping_lists_gift_target check (
    kind = 'regalos' or gift_for_member_id is null
  )
);

create index shopping_lists_family_idx
  on public.shopping_lists (family_id, position) where not is_archived;

create trigger shopping_lists_updated_at
  before update on public.shopping_lists
  for each row execute function public.set_updated_at();

create table public.shopping_items (
  id                   uuid primary key default gen_random_uuid(),
  family_id            uuid not null references public.families(id) on delete cascade,
  list_id              uuid not null references public.shopping_lists(id) on delete cascade,
  name                 text not null check (length(trim(name)) between 1 and 120),
  quantity             numeric(10, 2) check (quantity is null or quantity > 0),
  unit                 text,
  note                 text,
  -- Para la lista de regalos: el link al producto que se vio.
  url                  text,
  -- Plata SIEMPRE en centavos enteros. Ver src/lib/money.ts.
  est_price_cents      integer check (est_price_cents is null or est_price_cents >= 0),
  is_checked           boolean not null default false,
  checked_at           timestamptz,
  checked_by_member_id uuid references public.family_members(id) on delete set null,
  -- Un frecuente sobrevive al "vaciar comprados": vuelve destildado en vez de
  -- borrarse, porque la leche se compra todas las semanas.
  is_frequent          boolean not null default false,
  position             integer not null default 0,
  added_by_member_id   uuid references public.family_members(id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index shopping_items_list_idx
  on public.shopping_items (list_id, is_checked, position);

create trigger shopping_items_updated_at
  before update on public.shopping_items
  for each row execute function public.set_updated_at();

-- El "quién tildó y cuándo" lo sella el servidor, no el reloj del teléfono.
create or replace function public.shopping_items_stamp_check()
returns trigger
language plpgsql
as $$
begin
  if new.is_checked and not coalesce(old.is_checked, false) then
    new.checked_at := now();
    new.checked_by_member_id := coalesce(
      new.checked_by_member_id,
      (select id from public.family_members where profile_id = auth.uid())
    );
  elsif not new.is_checked then
    new.checked_at := null;
    new.checked_by_member_id := null;
  end if;
  return new;
end;
$$;

create trigger shopping_items_check_stamp
  before update on public.shopping_items
  for each row execute function public.shopping_items_stamp_check();

-- ---------------------------------------------------------------------------
-- Listas por defecto al crear la familia.
--
-- Va como trigger sobre `families` y no dentro de create_family() para que el
-- set de listas se pueda cambiar sin tocar la función de alta.
-- ---------------------------------------------------------------------------
create or replace function public.seed_default_shopping_lists()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.shopping_lists (family_id, name, kind, position) values
    (new.id, 'Súper',          'supermercado', 0),
    (new.id, 'Verdulería',     'verduleria',   1),
    (new.id, 'Farmacia',       'farmacia',     2),
    (new.id, 'Casa',           'hogar',        3),
    (new.id, 'Gustos',         'caprichos',    4);
  return new;
end;
$$;

create trigger families_seed_shopping_lists
  after insert on public.families
  for each row execute function public.seed_default_shopping_lists();

/**
 * Vacía lo comprado: borra los ítems tildados y destilda los frecuentes.
 * Es el botón de "terminé la compra" — deja la lista lista para la próxima.
 */
create or replace function public.clear_checked_items(p_list_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer;
begin
  if not exists (
    select 1 from public.shopping_lists
    where id = p_list_id and family_id = public.auth_family_id()
  ) then
    raise exception 'Esa lista no es de tu familia';
  end if;

  update public.shopping_items
     set is_checked = false, checked_at = null, checked_by_member_id = null
   where list_id = p_list_id and is_checked and is_frequent;

  delete from public.shopping_items
   where list_id = p_list_id and is_checked and not is_frequent;

  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS: las compras son de toda la casa, sin distinción de rol. Un chico tiene
-- que poder tildar la leche en la góndola.
-- ---------------------------------------------------------------------------
alter table public.shopping_lists enable row level security;
alter table public.shopping_items enable row level security;

create policy shopping_lists_select on public.shopping_lists
  for select to authenticated
  using (family_id = public.auth_family_id());

create policy shopping_lists_write on public.shopping_lists
  for all to authenticated
  using (family_id = public.auth_family_id())
  with check (family_id = public.auth_family_id());

create policy shopping_items_select on public.shopping_items
  for select to authenticated
  using (family_id = public.auth_family_id());

create policy shopping_items_write on public.shopping_items
  for all to authenticated
  using (family_id = public.auth_family_id())
  with check (family_id = public.auth_family_id());

-- Tachado en vivo: dos personas en el súper ven lo mismo.
alter publication supabase_realtime add table public.shopping_items;
