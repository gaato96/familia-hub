-- ===========================================================================
-- Fase 4: menú semanal, recetas y despensa.
--
-- El objetivo del módulo no es "tener recetas": es que el domingo alguien
-- decida qué se come la semana que viene y de ahí salga sola la lista del
-- súper. Todo el modelo está armado alrededor de esa cadena —
--
--   meal_plan -> recipe_ingredients -> (descontar lo que hay en pantry)
--             -> shopping_items
--
-- — y por eso los ingredientes de una receta guardan `name` como texto libre
-- además del vínculo opcional a la despensa: escribir "2 cebollas" tiene que
-- funcionar sin obligar a dar de alta "cebolla" como producto primero. Un
-- catálogo obligatorio es lo que hace que nadie cargue nunca una receta.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- recipes
-- ---------------------------------------------------------------------------
create table public.recipes (
  id            uuid primary key default gen_random_uuid(),
  family_id     uuid not null references public.families(id) on delete cascade,

  title         text not null check (length(trim(title)) between 1 and 120),
  instructions  text,
  servings      integer check (servings is null or servings between 1 and 50),
  -- Minutos. Para poder filtrar "algo rápido" un martes a las 20:30.
  minutes       integer check (minutes is null or minutes between 1 and 600),
  source_url    text,
  -- Foto en el bucket privado, misma convención de ruta que el resto.
  image_path    text,
  is_favorite   boolean not null default false,

  created_by_member_id uuid references public.family_members(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index recipes_family_idx on public.recipes (family_id, title);

create trigger recipes_updated_at
  before update on public.recipes
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- pantry_items — lo que hay en casa
--
-- `min_quantity` es lo que convierte la despensa en algo útil: por debajo de
-- ese número el ítem aparece como "hay que reponer" sin que nadie lo revise.
-- ---------------------------------------------------------------------------
create table public.pantry_items (
  id           uuid primary key default gen_random_uuid(),
  family_id    uuid not null references public.families(id) on delete cascade,

  name         text not null check (length(trim(name)) between 1 and 120),
  quantity     numeric(10, 2) not null default 0 check (quantity >= 0),
  unit         text,
  location     text not null default 'despensa'
               check (location in ('heladera', 'freezer', 'despensa', 'limpieza', 'otro')),
  -- Por debajo de esto, reponer.
  min_quantity numeric(10, 2) check (min_quantity is null or min_quantity >= 0),
  expires_on   date,
  notes        text,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  -- Un producto una vez por lugar: "leche" en la heladera y "leche" en la
  -- despensa son dos cosas distintas; dos "leche" en la heladera es un error
  -- de carga que rompe el descuento automático.
  unique (family_id, name, location)
);

create index pantry_items_family_idx on public.pantry_items (family_id, location);
create index pantry_items_expiry_idx on public.pantry_items (family_id, expires_on)
  where expires_on is not null;

create trigger pantry_items_updated_at
  before update on public.pantry_items
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- recipe_ingredients
-- ---------------------------------------------------------------------------
create table public.recipe_ingredients (
  id             uuid primary key default gen_random_uuid(),
  family_id      uuid not null references public.families(id) on delete cascade,
  recipe_id      uuid not null references public.recipes(id) on delete cascade,

  name           text not null check (length(trim(name)) between 1 and 120),
  quantity       numeric(10, 2) check (quantity is null or quantity > 0),
  unit           text,
  -- Vínculo OPCIONAL con la despensa. Sin él el ingrediente igual funciona;
  -- con él, la generación de la lista puede descontar lo que ya hay.
  pantry_item_id uuid references public.pantry_items(id) on delete set null,
  position       integer not null default 0,

  created_at     timestamptz not null default now()
);

create index recipe_ingredients_recipe_idx on public.recipe_ingredients (recipe_id, position);

-- ---------------------------------------------------------------------------
-- meal_plan — qué se come cada día
--
-- `recipe_id` O `free_text`, nunca los dos ni ninguno: la mitad de las cenas
-- de una casa son "sobras" o "pizza", que no merecen una receta cargada.
-- ---------------------------------------------------------------------------
create table public.meal_plan (
  id         uuid primary key default gen_random_uuid(),
  family_id  uuid not null references public.families(id) on delete cascade,

  meal_date  date not null,
  slot       text not null check (slot in ('almuerzo', 'cena')),
  recipe_id  uuid references public.recipes(id) on delete set null,
  free_text  text check (free_text is null or length(trim(free_text)) between 1 and 120),
  notes      text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Un plato por franja por día.
  unique (family_id, meal_date, slot),

  constraint meal_plan_has_content check (
    (recipe_id is not null and free_text is null)
    or (recipe_id is null and free_text is not null)
  )
);

create index meal_plan_week_idx on public.meal_plan (family_id, meal_date);

create trigger meal_plan_updated_at
  before update on public.meal_plan
  for each row execute function public.set_updated_at();

-- ===========================================================================
-- Generar la lista del súper desde el menú.
--
-- Es la función que justifica el módulo entero. Recorre los ingredientes de
-- las recetas planificadas entre dos fechas, descuenta lo que ya hay en la
-- despensa, y vuelca el faltante en una lista de compras.
--
-- Decisiones que importan:
--
-- - Agrupa por nombre normalizado (minúsculas, sin espacios de más): dos
--   recetas que piden cebolla no generan dos renglones de cebolla.
-- - Solo descuenta si el ingrediente está vinculado a la despensa Y las
--   unidades coinciden. Restar "200 g" de "1 paquete" daría un número
--   inventado, y una lista del súper que miente es peor que no tenerla.
-- - No duplica lo que ya está sin tildar en la lista: correrla dos veces no
--   deja la lista con todo por duplicado.
-- ===========================================================================
create or replace function public.generate_shopping_from_meals(
  p_from    date,
  p_to      date,
  p_list_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family  uuid := public.auth_family_id();
  v_added   integer := 0;
  v_row     record;
begin
  if v_family is null then
    raise exception 'No hay familia en contexto';
  end if;

  if not exists (
    select 1 from public.shopping_lists
    where id = p_list_id and family_id = v_family
  ) then
    raise exception 'Esa lista no es de tu familia';
  end if;

  for v_row in
    with needed as (
      select
        lower(trim(ri.name))                       as key,
        min(trim(ri.name))                         as display_name,
        -- max() y no un join: dos ingredientes con el mismo nombre podrían
        -- apuntar a filas de despensa distintas; se toma una.
        max(ri.unit)                               as unit,
        sum(coalesce(ri.quantity, 1))              as quantity,
        max(ri.pantry_item_id::text)::uuid         as pantry_item_id
      from public.meal_plan mp
      join public.recipe_ingredients ri on ri.recipe_id = mp.recipe_id
      where mp.family_id = v_family
        and mp.meal_date between p_from and p_to
        and mp.recipe_id is not null
      group by lower(trim(ri.name))
    )
    select
      n.key,
      n.display_name,
      n.unit,
      -- Descontar la despensa SOLO con unidades compatibles.
      case
        when p.id is not null
             and coalesce(lower(p.unit), '') = coalesce(lower(n.unit), '')
          then greatest(n.quantity - p.quantity, 0)
        else n.quantity
      end as missing
    from needed n
    left join public.pantry_items p on p.id = n.pantry_item_id
  loop
    -- Nada que comprar de este ingrediente.
    continue when v_row.missing <= 0;

    -- Ya está pendiente en la lista: no duplicar.
    continue when exists (
      select 1 from public.shopping_items si
      where si.list_id = p_list_id
        and not si.is_checked
        and lower(trim(si.name)) = v_row.key
    );

    insert into public.shopping_items (family_id, list_id, name, quantity, unit)
    values (v_family, p_list_id, v_row.display_name, v_row.missing, v_row.unit);

    v_added := v_added + 1;
  end loop;

  return v_added;
end;
$$;

revoke execute on function public.generate_shopping_from_meals(date, date, uuid)
  from anon, public;
grant execute on function public.generate_shopping_from_meals(date, date, uuid)
  to authenticated;

-- ===========================================================================
-- RLS: comer es de toda la casa.
--
-- A diferencia del expediente y de las finanzas, acá NO se pide `is_parent()`:
-- que un chico pueda anotar que quiere milanesas el jueves, o tildar que se
-- acabó la leche, es el punto.
-- ===========================================================================
alter table public.recipes            enable row level security;
alter table public.recipe_ingredients enable row level security;
alter table public.pantry_items       enable row level security;
alter table public.meal_plan          enable row level security;

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'recipes', 'recipe_ingredients', 'pantry_items', 'meal_plan'
  ]
  loop
    execute format(
      'create policy %I_select on public.%I
         for select to authenticated
         using (family_id = public.auth_family_id())',
      v_table, v_table
    );

    execute format(
      'create policy %I_write on public.%I
         for all to authenticated
         using (family_id = public.auth_family_id())
         with check (family_id = public.auth_family_id())',
      v_table, v_table
    );

    execute format(
      'create trigger %I_set_family_id before insert on public.%I
         for each row execute function public.set_family_id()',
      v_table, v_table
    );
  end loop;
end;
$$;

create trigger recipes_set_author
  before insert on public.recipes
  for each row execute function public.set_author_member('created_by_member_id');
