-- ===========================================================================
-- Eventos familiares del planner semanal.
--
-- A diferencia de las tareas, un evento NO se materializa en ocurrencias: no
-- se "completa", no rota responsable y no hay historial que auditar. Un evento
-- recurrente (el fútbol de los martes) se resuelve mucho más barato como una
-- tarea sin responsable, o repitiendo el evento a mano. Si algún día hace
-- falta recurrencia real acá, se reusa el modelo de tasks — no se inventa otro.
-- ===========================================================================

create table public.events (
  id                   uuid primary key default gen_random_uuid(),
  family_id            uuid not null references public.families(id) on delete cascade,
  title                text not null check (length(trim(title)) between 1 and 120),
  description          text,
  location             text,
  starts_at            timestamptz not null,
  ends_at              timestamptz,
  is_all_day           boolean not null default false,
  category             text not null default 'familia'
                       check (category in ('familia', 'salud', 'escuela', 'trabajo',
                                           'social', 'tramites', 'otros')),
  created_by_member_id uuid references public.family_members(id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),

  constraint events_ends_after_starts check (ends_at is null or ends_at >= starts_at)
);

create index events_agenda_idx on public.events (family_id, starts_at);

create trigger events_updated_at
  before update on public.events
  for each row execute function public.set_updated_at();

-- Quiénes van. Sin filas = es de toda la familia.
create table public.event_attendees (
  event_id  uuid not null references public.events(id) on delete cascade,
  member_id uuid not null references public.family_members(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  primary key (event_id, member_id)
);

create index event_attendees_member_idx on public.event_attendees (member_id);
