-- ===========================================================================
-- Tareas del hogar, limpieza y rutinas recurrentes.
--
-- Modelo de dos niveles, y es la decisión estructural del módulo:
--
--   tasks           = la REGLA  ("lavar sábanas cada 15 días, rotando")
--   task_instances  = la OCURRENCIA concreta ("el 3/9 le toca a papá")
--
-- Guardar solo la regla y calcular las fechas al vuelo parece más simple hasta
-- que hace falta posponer UNA semana, reasignar UNA vez, o saber quién limpió
-- realmente el baño en julio. Materializar las ocurrencias hace todo eso
-- trivial y deja al planner con una única query sobre task_instances.
--
-- Una tarea puntual es simplemente una regla con recurrence = null y una sola
-- ocurrencia, así el planner nunca tiene que mirar dos tablas.
-- ===========================================================================

create table public.tasks (
  id                  uuid primary key default gen_random_uuid(),
  family_id           uuid not null references public.families(id) on delete cascade,
  title               text not null check (length(trim(title)) between 1 and 120),
  notes               text,
  category            text not null default 'hogar'
                      check (category in ('hogar', 'limpieza', 'cocina', 'compras',
                                          'tramites', 'julian', 'otros')),
  priority            text not null default 'normal'
                      check (priority in ('baja', 'normal', 'alta')),

  -- Ancla de la recurrencia y fecha de la única ocurrencia si es puntual.
  starts_on           date not null default current_date,

  -- null = tarea puntual. Tres formas, y nada más — son las que una casa
  -- necesita de verdad, y cada una extra es una rama más que puede fallar:
  --   {"freq":"days",    "interval":15}        cada N días
  --   {"freq":"weekly",  "byweekday":[1,4]}    lunes y jueves (0=domingo)
  --   {"freq":"monthly", "bymonthday":28}      el 28 de cada mes
  recurrence          jsonb,

  -- Vacío = sin responsable fijo. Un elemento = siempre el mismo. Varios = rota
  -- por ocurrencia, en orden, de forma determinística.
  rotation_member_ids uuid[] not null default '{}',

  is_archived         boolean not null default false,
  created_by_member_id uuid references public.family_members(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint tasks_recurrence_shape check (
    recurrence is null or (
      recurrence ->> 'freq' in ('days', 'weekly', 'monthly')
      and (
        (recurrence ->> 'freq' = 'days'
          and (recurrence ->> 'interval')::integer between 1 and 365)
        or
        (recurrence ->> 'freq' = 'weekly'
          and jsonb_typeof(recurrence -> 'byweekday') = 'array'
          and jsonb_array_length(recurrence -> 'byweekday') between 1 and 7)
        or
        (recurrence ->> 'freq' = 'monthly'
          and (recurrence ->> 'bymonthday')::integer between 1 and 31)
      )
    )
  )
);

create index tasks_family_idx on public.tasks (family_id) where not is_archived;

create trigger tasks_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Los pasos de la tarea: el "qué hacer / qué NO hacer" de las de limpieza.
-- ---------------------------------------------------------------------------
create table public.task_steps (
  id        uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  task_id   uuid not null references public.tasks(id) on delete cascade,
  label     text not null check (length(trim(label)) between 1 and 160),
  kind      text not null default 'do' check (kind in ('do', 'dont')),
  position  integer not null default 0
);

create index task_steps_task_idx on public.task_steps (task_id, position);

-- ---------------------------------------------------------------------------
-- task_instances — la ocurrencia concreta
-- ---------------------------------------------------------------------------
create table public.task_instances (
  id                     uuid primary key default gen_random_uuid(),
  family_id              uuid not null references public.families(id) on delete cascade,
  task_id                uuid not null references public.tasks(id) on delete cascade,
  due_date               date not null,
  assigned_member_id     uuid references public.family_members(id) on delete set null,
  status                 text not null default 'pending'
                         check (status in ('pending', 'done', 'skipped')),
  completed_at           timestamptz,
  completed_by_member_id uuid references public.family_members(id) on delete set null,
  -- Pasos tildados de esta ocurrencia. Array en vez de tabla puente: se leen y
  -- escriben siempre junto con la instancia, nunca por separado.
  done_step_ids          uuid[] not null default '{}',
  note                   text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),

  -- Lo que hace idempotente a ensure_task_instances(): puede correr en cada
  -- carga del planner y simplemente no duplicar nada.
  unique (task_id, due_date)
);

create index task_instances_agenda_idx
  on public.task_instances (family_id, due_date, status);
create index task_instances_assignee_idx
  on public.task_instances (assigned_member_id, due_date)
  where status = 'pending';

create trigger task_instances_updated_at
  before update on public.task_instances
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Marcar completada: sella quién y cuándo del lado del servidor.
-- Que el cliente mande completed_at sería confiar en el reloj del teléfono.
-- ---------------------------------------------------------------------------
create or replace function public.task_instances_stamp_completion()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'done' and coalesce(old.status, '') <> 'done' then
    new.completed_at := now();
    new.completed_by_member_id := coalesce(
      new.completed_by_member_id,
      (select id from public.family_members where profile_id = auth.uid())
    );
  elsif new.status <> 'done' then
    new.completed_at := null;
    new.completed_by_member_id := null;
  end if;
  return new;
end;
$$;

create trigger task_instances_completion
  before update on public.task_instances
  for each row execute function public.task_instances_stamp_completion();
