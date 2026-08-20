-- ===========================================================================
-- Fase 3: finanzas del hogar.
--
-- Dos reglas que no se negocian, y las dos existen por el mismo motivo —que
-- la plata cierre exactamente:
--
--   1. Los montos son SIEMPRE centavos enteros (`integer`), nunca float ni
--      numeric con decimales. Ver src/lib/money.ts.
--   2. Los porcentajes son BASIS POINTS enteros (10000 = 100%), nunca 0.35.
--      Con decimales, seis rubros que "suman 100%" terminan sumando 99.99 y
--      el reparto muestra una diferencia que nadie puede explicar.
--
-- El motor de reparto vive en TypeScript (`splitByBasisPoints` en
-- src/lib/money.ts) y no en SQL: es una función pura que la pantalla necesita
-- recalcular en vivo mientras alguien mueve un porcentaje, sin ida y vuelta.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- income_entries — lo que entra
--
-- Una fila por ingreso y por mes, no un "sueldo" fijo por persona: en
-- Argentina el mismo sueldo cambia todos los meses, y además hay aguinaldo,
-- changas y ventas sueltas. Guardar el histórico es lo que después permite
-- mirar para atrás.
-- ---------------------------------------------------------------------------
create table public.income_entries (
  id           uuid primary key default gen_random_uuid(),
  family_id    uuid not null references public.families(id) on delete cascade,
  member_id    uuid references public.family_members(id) on delete set null,

  label        text not null check (length(trim(label)) between 1 and 80),
  amount_cents integer not null check (amount_cents > 0),

  -- El primer día del mes al que corresponde. Se normaliza con un trigger
  -- para que "septiembre" sea siempre 2026-09-01 y los agrupados cierren.
  period_month date not null,
  received_on  date,
  notes        text,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index income_entries_period_idx on public.income_entries (family_id, period_month);

create trigger income_entries_updated_at
  before update on public.income_entries
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- budget_allocations — cómo se reparte el fondo común
--
-- Los seis rubros del pedido original vienen sembrados, pero la tabla es
-- abierta: agregar "vacaciones" tiene que ser una fila, no una migración.
--
-- `member_id` marca las asignaciones personales ("libre disponibilidad sin
-- fiscalización"): son de alguien en particular y la app no pide detalle de
-- en qué se gastaron. Es una decisión de producto, no una limitación.
-- ---------------------------------------------------------------------------
create table public.budget_allocations (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null references public.families(id) on delete cascade,

  label       text not null check (length(trim(label)) between 1 and 60),
  -- Basis points: 10000 = 100%, 3500 = 35%.
  percent_bp  integer not null check (percent_bp between 0 and 10000),
  member_id   uuid references public.family_members(id) on delete cascade,
  color       text not null default '#6D4AFF' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  position    integer not null default 0,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index budget_allocations_family_idx on public.budget_allocations (family_id, position);

create trigger budget_allocations_updated_at
  before update on public.budget_allocations
  for each row execute function public.set_updated_at();

/**
 * ¿Cuánto suman los porcentajes de esta familia?
 *
 * NO hay un CHECK que obligue a 10000. Un constraint así haría imposible
 * editar: bajar un rubro del 35% al 30% dejaría el total en 9500 y la base
 * rechazaría el UPDATE antes de poder subir otro. La suma se valida en la
 * pantalla, que muestra cuánto falta o cuánto sobra mientras se edita.
 */
create or replace function public.budget_total_bp()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(percent_bp), 0)::integer
  from public.budget_allocations
  where family_id = public.auth_family_id();
$$;

-- ---------------------------------------------------------------------------
-- expenses — lo que sale, ordenado por vencimiento
--
-- La vista principal del módulo es "qué vence primero", no "en qué gastamos".
-- Por eso `due_date` es NOT NULL y está indexada junto con el estado: la
-- pregunta que la app tiene que contestar en un segundo es "¿qué hay que pagar
-- esta semana?".
-- ---------------------------------------------------------------------------
create table public.expenses (
  id             uuid primary key default gen_random_uuid(),
  family_id      uuid not null references public.families(id) on delete cascade,

  label          text not null check (length(trim(label)) between 1 and 80),
  category       text not null default 'varios'
                 check (category in ('alquiler', 'expensas', 'servicios', 'tarjeta',
                                     'prestamo', 'salud', 'julian', 'super',
                                     'transporte', 'suscripcion', 'varios')),
  amount_cents   integer not null check (amount_cents > 0),
  due_date       date not null,

  -- `paid_on` es la fuente de verdad; el estado se deriva. Guardar un campo
  -- `status` editable a mano daría lugar a filas "pagadas" sin fecha de pago.
  paid_on        date,
  paid_by_member_id uuid references public.family_members(id) on delete set null,

  -- A qué rubro del presupuesto se imputa. Nullable: un gasto puede existir
  -- antes de decidir de dónde sale.
  allocation_id  uuid references public.budget_allocations(id) on delete set null,
  -- Comprobante de pago, en la misma caja fuerte que el resto de los papeles.
  document_id    uuid references public.documents(id) on delete set null,

  -- Marca los gastos que se repiten todos los meses, para poder clonarlos.
  is_recurring   boolean not null default false,
  notes          text,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index expenses_due_idx on public.expenses (family_id, due_date);
create index expenses_pending_idx on public.expenses (family_id, due_date)
  where paid_on is null;

create trigger expenses_updated_at
  before update on public.expenses
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Normalizar el mes al día 1: sin esto, "septiembre" cargado el 3 y el 15
-- serían dos meses distintos al agrupar.
-- ---------------------------------------------------------------------------
create or replace function public.normalize_period_month()
returns trigger
language plpgsql
as $$
begin
  new.period_month := date_trunc('month', new.period_month::timestamp)::date;
  return new;
end;
$$;

create trigger income_entries_normalize_month
  before insert or update on public.income_entries
  for each row execute function public.normalize_period_month();

-- ---------------------------------------------------------------------------
-- Quién pagó lo sella el servidor, igual que en tareas y compras.
-- ---------------------------------------------------------------------------
create or replace function public.expenses_stamp_payment()
returns trigger
language plpgsql
as $$
begin
  if new.paid_on is not null and old.paid_on is null then
    new.paid_by_member_id := coalesce(
      new.paid_by_member_id,
      (select id from public.family_members where profile_id = auth.uid())
    );
  elsif new.paid_on is null then
    new.paid_by_member_id := null;
  end if;
  return new;
end;
$$;

create trigger expenses_payment_stamp
  before update on public.expenses
  for each row execute function public.expenses_stamp_payment();

-- ---------------------------------------------------------------------------
-- Rubros por defecto: los seis del pedido original.
--
-- Van como trigger sobre `families` —igual que las listas de compras— para
-- poder cambiar el set sin tocar la función de alta.
-- ---------------------------------------------------------------------------
create or replace function public.seed_default_allocations()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.budget_allocations (family_id, label, percent_bp, color, position) values
    (new.id, 'Gastos fijos y servicios', 3500, '#2563EB', 0),
    (new.id, 'Fondo de reserva',         1000, '#16A34A', 1),
    (new.id, 'Casa y compras',           2500, '#A16207', 2),
    (new.id, 'Rubro Julián',             1500, '#0EA5E9', 3),
    (new.id, 'Libre — Mamá',              750, '#DB2777', 4),
    (new.id, 'Libre — Papá',              750, '#EA580C', 5);
  return new;
end;
$$;

create trigger families_seed_allocations
  after insert on public.families
  for each row execute function public.seed_default_allocations();

-- ===========================================================================
-- RLS: finanzas es de adultos, como el expediente.
--
-- Un chico no tiene por qué ver cuánto gana cada uno ni cuánto se debe. Y las
-- asignaciones personales son explícitamente "sin fiscalización": ni siquiera
-- entre los adultos se piden comprobantes de ese rubro.
-- ===========================================================================
alter table public.income_entries      enable row level security;
alter table public.budget_allocations  enable row level security;
alter table public.expenses            enable row level security;

do $$
declare
  v_table text;
begin
  foreach v_table in array array['income_entries', 'budget_allocations', 'expenses']
  loop
    execute format(
      'create policy %I_select on public.%I
         for select to authenticated
         using (family_id = public.auth_family_id() and public.is_parent())',
      v_table, v_table
    );

    execute format(
      'create policy %I_write on public.%I
         for all to authenticated
         using (family_id = public.auth_family_id() and public.is_parent())
         with check (family_id = public.auth_family_id() and public.is_parent())',
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
