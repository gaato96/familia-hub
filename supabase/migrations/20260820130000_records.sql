-- ===========================================================================
-- Fase 2: expediente de salud y datos personales.
--
-- Todo cuelga de `family_members`, no de `profiles`. Es la decisión que hace
-- que este módulo sirva igual para Julián (que no tiene cuenta) que para mamá
-- y papá, sin ninguna migración extra el día que quieran cargar sus estudios.
--
-- Los datos sensibles (DNI, CUIL, obra social) viven en una tabla APARTE de
-- family_members y no como columnas más. Motivo: `family_members` la lee toda
-- la app en cada pantalla —el planner, las compras, el chip de avatar— y no
-- hay razón para que el número de documento de un menor viaje en cada una de
-- esas respuestas.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- member_details — datos personales y legales
-- ---------------------------------------------------------------------------
create table public.member_details (
  member_id            uuid primary key references public.family_members(id) on delete cascade,
  family_id            uuid not null references public.families(id) on delete cascade,

  full_legal_name      text,
  dni                  text check (dni is null or dni ~ '^[0-9]{7,8}$'),
  cuil                 text check (cuil is null or cuil ~ '^[0-9]{2}-?[0-9]{7,8}-?[0-9]$'),
  -- text + CHECK y no ENUM: si algún día hace falta 'desconocido', es una
  -- migración de una línea.
  blood_type           text check (blood_type in ('A+','A-','B+','B-','AB+','AB-','O+','O-')),

  health_insurance     text,
  health_insurance_id  text,
  -- Lo que se lee en una guardia. Va acá y no en un adjunto: en una urgencia
  -- nadie abre un PDF.
  allergies            text,
  conditions           text,
  emergency_notes      text,

  address              text,
  birth_place          text,

  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index member_details_family_idx on public.member_details (family_id);

create trigger member_details_updated_at
  before update on public.member_details
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- documents — caja fuerte documental
--
-- Una sola tabla para el DNI de Julián, el contrato de alquiler y la garantía
-- del lavarropas. `member_id` nullable es lo que las distingue: con integrante
-- es del expediente de esa persona, sin integrante es de la casa.
-- ---------------------------------------------------------------------------
create table public.documents (
  id                uuid primary key default gen_random_uuid(),
  family_id         uuid not null references public.families(id) on delete cascade,
  member_id         uuid references public.family_members(id) on delete cascade,

  title             text not null check (length(trim(title)) between 1 and 120),
  description       text,
  category          text not null default 'otros'
                    check (category in ('identidad', 'salud', 'escuela', 'vivienda',
                                        'vehiculo', 'garantia', 'seguro', 'finanzas',
                                        'otros')),

  -- Ruta en el bucket privado: {family_id}/{member_id|_casa}/{uuid}.{ext}
  storage_path      text not null unique,
  mime_type         text not null,
  size_bytes        integer not null check (size_bytes > 0),

  issued_on         date,
  -- Para lo que caduca: DNI, seguro, carnet.
  expires_on        date,

  uploaded_by_member_id uuid references public.family_members(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index documents_family_idx on public.documents (family_id, category);
create index documents_member_idx on public.documents (member_id);
create index documents_expiry_idx on public.documents (family_id, expires_on)
  where expires_on is not null;

create trigger documents_updated_at
  before update on public.documents
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- medications — qué toma, para qué, cada cuánto
-- ---------------------------------------------------------------------------
create table public.medications (
  id            uuid primary key default gen_random_uuid(),
  family_id     uuid not null references public.families(id) on delete cascade,
  member_id     uuid not null references public.family_members(id) on delete cascade,

  name          text not null check (length(trim(name)) between 1 and 120),
  dose          text,
  frequency     text,
  -- El pedido explícito era "qué hace cada remedio, síntomas": esto es lo que
  -- convierte una lista de cajas en algo que sirve a las 3 de la mañana.
  treats        text,
  notes         text,
  prescribed_by text,

  started_on    date,
  ended_on      date,
  -- Derivable de ended_on, pero explícito: un remedio "a demanda" no tiene
  -- fecha de fin y aun así no está activo hoy.
  is_active     boolean not null default true,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index medications_member_idx on public.medications (member_id, is_active);

create trigger medications_updated_at
  before update on public.medications
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- vaccines — calendario de vacunación
-- ---------------------------------------------------------------------------
create table public.vaccines (
  id           uuid primary key default gen_random_uuid(),
  family_id    uuid not null references public.families(id) on delete cascade,
  member_id    uuid not null references public.family_members(id) on delete cascade,

  name         text not null check (length(trim(name)) between 1 and 120),
  -- "1ra dosis", "refuerzo", "anual". Texto libre: el calendario oficial
  -- cambia y no vale la pena modelarlo.
  dose_label   text,
  applied_on   date,
  due_on       date,
  place        text,
  batch_number text,
  notes        text,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  -- Una vacuna sin aplicar ni pendiente no es nada.
  constraint vaccines_has_a_date check (applied_on is not null or due_on is not null)
);

create index vaccines_member_idx on public.vaccines (member_id, applied_on);
create index vaccines_pending_idx on public.vaccines (family_id, due_on)
  where applied_on is null;

create trigger vaccines_updated_at
  before update on public.vaccines
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- medical_visits — consultas
-- ---------------------------------------------------------------------------
create table public.medical_visits (
  id            uuid primary key default gen_random_uuid(),
  family_id     uuid not null references public.families(id) on delete cascade,
  member_id     uuid not null references public.family_members(id) on delete cascade,

  visited_on    date not null,
  specialty     text,
  professional  text,
  place         text,
  reason        text,
  diagnosis     text,
  indications   text,
  next_visit_on date,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index medical_visits_member_idx on public.medical_visits (member_id, visited_on desc);

create trigger medical_visits_updated_at
  before update on public.medical_visits
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- growth_records — peso, talla, perímetro cefálico
--
-- Enteros en las unidades más chicas (gramos, milímetros) por el mismo motivo
-- que la plata va en centavos: nada de floats en datos que se comparan y
-- grafican.
-- ---------------------------------------------------------------------------
create table public.growth_records (
  id                 uuid primary key default gen_random_uuid(),
  family_id          uuid not null references public.families(id) on delete cascade,
  member_id          uuid not null references public.family_members(id) on delete cascade,

  measured_on        date not null,
  weight_grams       integer check (weight_grams is null or weight_grams between 200 and 300000),
  height_mm          integer check (height_mm is null or height_mm between 200 and 2500),
  head_circ_mm       integer check (head_circ_mm is null or head_circ_mm between 200 and 700),
  notes              text,

  created_at         timestamptz not null default now(),

  -- Una medición por persona por día: dos pesadas el mismo día son un error
  -- de carga, no dos datos.
  unique (member_id, measured_on)
);

create index growth_records_member_idx on public.growth_records (member_id, measured_on);

-- ---------------------------------------------------------------------------
-- milestones — hitos de desarrollo
-- ---------------------------------------------------------------------------
create table public.milestones (
  id           uuid primary key default gen_random_uuid(),
  family_id    uuid not null references public.families(id) on delete cascade,
  member_id    uuid not null references public.family_members(id) on delete cascade,

  title        text not null check (length(trim(title)) between 1 and 160),
  achieved_on  date not null,
  notes        text,

  created_at   timestamptz not null default now()
);

create index milestones_member_idx on public.milestones (member_id, achieved_on desc);

-- ---------------------------------------------------------------------------
-- member_sizes — talles actuales
--
-- Existe para una cosa muy concreta: estar parado en un local y saber qué
-- talle de zapatilla calza. Por eso guarda historial (`valid_from`) en vez de
-- pisar el valor: sirve para ver cómo viene creciendo.
-- ---------------------------------------------------------------------------
create table public.member_sizes (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null references public.families(id) on delete cascade,
  member_id   uuid not null references public.family_members(id) on delete cascade,

  kind        text not null check (kind in ('ropa', 'calzado', 'pantalon', 'abrigo', 'otro')),
  value       text not null check (length(trim(value)) between 1 and 20),
  notes       text,
  valid_from  date not null default current_date,

  created_at  timestamptz not null default now(),

  unique (member_id, kind, valid_from)
);

create index member_sizes_member_idx on public.member_sizes (member_id, kind, valid_from desc);

-- ---------------------------------------------------------------------------
-- contacts — pediatra, urgencias, plomero
-- ---------------------------------------------------------------------------
create table public.contacts (
  id            uuid primary key default gen_random_uuid(),
  family_id     uuid not null references public.families(id) on delete cascade,

  name          text not null check (length(trim(name)) between 1 and 120),
  role          text,
  phone         text,
  alt_phone     text,
  notes         text,
  category      text not null default 'otros'
                check (category in ('salud', 'urgencias', 'escuela', 'servicios',
                                    'familia', 'otros')),
  -- Los que salen en la ficha de emergencia, arriba de todo.
  is_emergency  boolean not null default false,
  position      integer not null default 0,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index contacts_family_idx on public.contacts (family_id, position);

create trigger contacts_updated_at
  before update on public.contacts
  for each row execute function public.set_updated_at();
