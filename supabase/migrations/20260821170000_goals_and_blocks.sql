-- ===========================================================================
-- Fase 5: objetivos y bloques de horarios.
--
-- Son dos cosas distintas y conviene no confundirlas con lo que ya existe:
--
--   tasks         = lo que HAY QUE HACER y se tilda      ("lavar sábanas")
--   events        = lo que PASA en un momento            ("dentista 14:00")
--   goals         = a dónde QUIERE LLEGAR la casa        ("ordenar el garage")
--   time_blocks   = la FORMA del día, lo que ya está     ("mamá trabaja 9-18")
--
-- Un bloque no se tilda y no se cumple: describe dónde está cada uno. Es lo
-- que contesta "¿puedo pedirle a papá que lo lleve al club a las 17?" sin
-- preguntar. Por eso no genera ocurrencias como las tareas: no hay nada que
-- completar, así que materializar 365 filas por bloque sería guardar basura.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- goals — el objetivo
--
-- El estado es una columna y NO se deriva de los pasos, al revés de lo que
-- hace `expenses` con `paid_on`. La diferencia es real: un vencimiento está
-- pagado o no lo está, pero un objetivo se puede dar por logrado con dos pasos
-- sin tildar (se resolvió de otra forma) o seguir abierto con todos tildados
-- (faltaba algo que nadie anotó). Derivarlo obligaría a inventar pasos para
-- poder cerrarlo.
-- ---------------------------------------------------------------------------
create table public.goals (
  id            uuid primary key default gen_random_uuid(),
  family_id     uuid not null references public.families(id) on delete cascade,

  title         text not null check (length(trim(title)) between 1 and 140),
  detail        text,
  category      text not null default 'casa'
                check (category in ('casa', 'familia', 'salud', 'plata', 'estudio', 'proyecto')),

  -- null = objetivo de toda la casa. Es el caso por defecto y el más común:
  -- "que el desayuno deje de ser un caos" no es de nadie en particular.
  owner_member_id uuid references public.family_members(id) on delete set null,

  target_date   date,
  status        text not null default 'activo'
                check (status in ('activo', 'logrado', 'pausado', 'archivado')),
  achieved_on   date,

  position      integer not null default 0,

  created_by_member_id uuid references public.family_members(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index goals_family_idx on public.goals (family_id, status, position);
create index goals_owner_idx on public.goals (family_id, owner_member_id)
  where owner_member_id is not null;

create trigger goals_updated_at
  before update on public.goals
  for each row execute function public.set_updated_at();

/**
 * Sella la fecha en que se logró.
 *
 * Mismo criterio que `expenses_stamp_payment`: la fecha la pone la base al
 * cambiar el estado, no un campo que alguien tiene que acordarse de llenar.
 * Volver a "activo" la borra — un objetivo reabierto con fecha de logro es una
 * fila que se contradice a sí misma.
 */
create or replace function public.goals_stamp_achieved()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'logrado' and new.achieved_on is null then
    new.achieved_on := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
  elsif new.status <> 'logrado' then
    new.achieved_on := null;
  end if;
  return new;
end;
$$;

create trigger goals_stamp_achieved
  before insert or update on public.goals
  for each row execute function public.goals_stamp_achieved();

-- ---------------------------------------------------------------------------
-- goal_steps — el objetivo partido en cosas que alguien puede agarrar
--
-- Es lo que separa un objetivo de un deseo. "Ordenar el garage" no se hace;
-- "sacar las cajas del fondo" sí. Cada paso lleva responsable y fecha porque
-- el pedido era justamente poder ayudarse entre todos: sin nombre al lado, la
-- lista de pasos es una lista de reproches.
--
-- Un paso NO es una `task`: no se repite, no rota, no genera ocurrencias.
-- Meterlos en `tasks` hubiera contaminado el planner con cincuenta filas que
-- no son del día a día de la casa.
-- ---------------------------------------------------------------------------
create table public.goal_steps (
  id            uuid primary key default gen_random_uuid(),
  family_id     uuid not null references public.families(id) on delete cascade,
  goal_id       uuid not null references public.goals(id) on delete cascade,

  title         text not null check (length(trim(title)) between 1 and 160),
  assigned_member_id uuid references public.family_members(id) on delete set null,
  due_date      date,

  done_at       timestamptz,
  done_by_member_id uuid references public.family_members(id) on delete set null,

  position      integer not null default 0,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index goal_steps_goal_idx on public.goal_steps (goal_id, position);
create index goal_steps_assignee_idx on public.goal_steps (family_id, assigned_member_id)
  where done_at is null;

create trigger goal_steps_updated_at
  before update on public.goal_steps
  for each row execute function public.set_updated_at();

/** Quién lo tildó sale de la sesión, no del cliente. */
create or replace function public.goal_steps_stamp_done()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.done_at is not null and new.done_by_member_id is null then
    new.done_by_member_id := public.auth_member_id();
  elsif new.done_at is null then
    new.done_by_member_id := null;
  end if;
  return new;
end;
$$;

create trigger goal_steps_stamp_done
  before insert or update on public.goal_steps
  for each row execute function public.goal_steps_stamp_done();

-- ---------------------------------------------------------------------------
-- time_blocks — la forma del día
--
-- Un bloque es recurrente por día de semana (lo normal: "mamá trabaja lunes a
-- viernes de 9 a 18") o puntual de una fecha (lo excepcional: "el jueves papá
-- viaja"). Nunca las dos cosas — el CHECK lo impide, porque una fila que sea
-- las dos no tiene forma de mostrarse.
--
-- **Los bloques no cruzan la medianoche** (`ends_at > starts_at`). Un turno
-- noche de 22 a 06 se carga como dos bloques. La alternativa —permitir el
-- cruce— obliga a que TODA la aritmética de la vista diaria maneje bloques que
-- empiezan ayer, y el 99% de los bloques de una casa no cruzan nada.
-- ---------------------------------------------------------------------------
create table public.time_blocks (
  id            uuid primary key default gen_random_uuid(),
  family_id     uuid not null references public.families(id) on delete cascade,

  -- null = bloque de toda la casa ("almuerzo", "cena", "silencio").
  member_id     uuid references public.family_members(id) on delete cascade,

  title         text not null check (length(trim(title)) between 1 and 80),
  kind          text not null default 'otro'
                check (kind in ('trabajo', 'estudio', 'descanso', 'comida',
                                'cuidado', 'traslado', 'ocio', 'otro')),

  starts_at     time not null,
  ends_at       time not null,

  -- ISO: 1 = lunes ... 7 = domingo. Igual que el resto del planner, que
  -- arranca la semana el lunes.
  weekdays      smallint[],
  on_date       date,

  -- Vigencia del recurrente: "mamá cambió de horario en marzo" se resuelve
  -- cerrando el bloque viejo, no borrándolo, así el historial del planner de
  -- febrero sigue siendo cierto.
  starts_on     date,
  ends_on       date,

  notes         text,

  created_by_member_id uuid references public.family_members(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint time_blocks_span check (ends_at > starts_at),
  constraint time_blocks_shape check (
    (weekdays is not null
      and on_date is null
      and array_length(weekdays, 1) between 1 and 7
      and weekdays <@ array[1, 2, 3, 4, 5, 6, 7]::smallint[])
    or (weekdays is null and on_date is not null)
  ),
  constraint time_blocks_validity check (
    starts_on is null or ends_on is null or ends_on >= starts_on
  )
);

create index time_blocks_family_idx on public.time_blocks (family_id, starts_at);
create index time_blocks_date_idx on public.time_blocks (family_id, on_date)
  where on_date is not null;

create trigger time_blocks_updated_at
  before update on public.time_blocks
  for each row execute function public.set_updated_at();

-- ===========================================================================
-- RLS
--
-- Objetivos y bloques los ve y los escribe toda la casa: son exactamente el
-- lugar donde un chico tiene que poder anotar que se ofrece a hacer algo, o
-- ver a qué hora vuelve el padre. No llevan `is_parent()`.
--
-- Lo que sí se restringe es BORRAR y REESCRIBIR un objetivo ajeno — mismo
-- criterio que `tasks`: cualquiera crea y cualquiera tilda, solo un adulto o
-- el autor rehace lo que armó otro.
-- ===========================================================================
alter table public.goals       enable row level security;
alter table public.goal_steps  enable row level security;
alter table public.time_blocks enable row level security;

do $$
declare
  v_table text;
begin
  foreach v_table in array array['goals', 'goal_steps', 'time_blocks']
  loop
    execute format(
      'create policy %I_select on public.%I
         for select to authenticated
         using (family_id = public.auth_family_id())',
      v_table, v_table
    );

    execute format(
      'create policy %I_insert on public.%I
         for insert to authenticated
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

-- --- goals: el autor o un adulto ------------------------------------------
create policy goals_update on public.goals
  for update to authenticated
  using (
    family_id = public.auth_family_id()
    and (public.is_parent() or created_by_member_id = public.auth_member_id())
  )
  with check (family_id = public.auth_family_id());

create policy goals_delete on public.goals
  for delete to authenticated
  using (
    family_id = public.auth_family_id()
    and (public.is_parent() or created_by_member_id = public.auth_member_id())
  );

-- --- goal_steps: cualquiera tilda -----------------------------------------
-- Sin restricción de autor a propósito: el valor del módulo es que alguien
-- agarre un paso que no es suyo. Pedir permiso para ayudar no tiene sentido.
create policy goal_steps_update on public.goal_steps
  for update to authenticated
  using (family_id = public.auth_family_id())
  with check (family_id = public.auth_family_id());

create policy goal_steps_delete on public.goal_steps
  for delete to authenticated
  using (family_id = public.auth_family_id());

-- --- time_blocks: el dueño del bloque, el autor o un adulto ---------------
create policy time_blocks_update on public.time_blocks
  for update to authenticated
  using (
    family_id = public.auth_family_id()
    and (
      public.is_parent()
      or created_by_member_id = public.auth_member_id()
      or member_id = public.auth_member_id()
    )
  )
  with check (family_id = public.auth_family_id());

create policy time_blocks_delete on public.time_blocks
  for delete to authenticated
  using (
    family_id = public.auth_family_id()
    and (
      public.is_parent()
      or created_by_member_id = public.auth_member_id()
      or member_id = public.auth_member_id()
    )
  );

create trigger goals_set_author
  before insert on public.goals
  for each row execute function public.set_author_member('created_by_member_id');

create trigger time_blocks_set_author
  before insert on public.time_blocks
  for each row execute function public.set_author_member('created_by_member_id');

-- Realtime en los pasos: es el caso de "yo lo hago" gritado desde la otra
-- punta de la casa mientras los dos miran la misma pantalla.
alter publication supabase_realtime add table public.goal_steps;
