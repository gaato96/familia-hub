-- ===========================================================================
-- RLS del expediente.
--
-- Criterio distinto al del planner, y a propósito: el expediente lo ven y lo
-- escriben SOLO los adultos (`parent`). Un chico de la casa no tiene por qué
-- leer el DNI, la obra social ni el historial médico de su hermano — y menos
-- el de sus padres, que usan las mismas tablas.
--
-- La excepción es `contacts`: el teléfono del pediatra y el de urgencias
-- tienen que estar al alcance de cualquiera de la casa. Es justamente el dato
-- que sirve cuando el adulto NO está.
-- ===========================================================================

alter table public.member_details  enable row level security;
alter table public.documents       enable row level security;
alter table public.medications     enable row level security;
alter table public.vaccines        enable row level security;
alter table public.medical_visits  enable row level security;
alter table public.growth_records  enable row level security;
alter table public.milestones      enable row level security;
alter table public.member_sizes    enable row level security;
alter table public.contacts        enable row level security;

-- ---------------------------------------------------------------------------
-- Tablas de expediente: solo adultos, y solo dentro de la propia familia.
--
-- Se generan en un bucle en vez de escribir nueve pares de policies a mano:
-- copiar y pegar es exactamente cómo aparece la que se olvidó el `is_parent()`.
-- ---------------------------------------------------------------------------
do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'member_details', 'documents', 'medications', 'vaccines',
    'medical_visits', 'growth_records', 'milestones', 'member_sizes'
  ]
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
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- contacts — los lee toda la casa, los edita un adulto
-- ---------------------------------------------------------------------------
create policy contacts_select on public.contacts
  for select to authenticated
  using (family_id = public.auth_family_id());

create policy contacts_write on public.contacts
  for all to authenticated
  using (family_id = public.auth_family_id() and public.is_parent())
  with check (family_id = public.auth_family_id() and public.is_parent());

-- ---------------------------------------------------------------------------
-- family_id y autoría automáticos, igual que en el resto de las tablas.
-- Ver el porqué en 20260820121100_tenant_defaults.sql.
-- ---------------------------------------------------------------------------
do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'member_details', 'documents', 'medications', 'vaccines',
    'medical_visits', 'growth_records', 'milestones', 'member_sizes', 'contacts'
  ]
  loop
    execute format(
      'create trigger %I_set_family_id before insert on public.%I
         for each row execute function public.set_family_id()',
      v_table, v_table
    );
  end loop;
end;
$$;

create trigger documents_set_uploader
  before insert on public.documents
  for each row execute function public.set_author_member('uploaded_by_member_id');

-- ===========================================================================
-- Ficha de emergencia
--
-- Una función y no una vista: tiene que ser legible por CUALQUIER integrante
-- —incluido un chico— aunque las tablas de abajo estén cerradas a los adultos.
-- SECURITY DEFINER la deja saltear esas policies y devolver solo el subconjunto
-- que hace falta en una guardia: grupo sanguíneo, alergias, condiciones y
-- medicación activa. Nada de DNI, obra social ni historial de consultas.
--
-- Es la única puerta de la app que expone datos del expediente a un `child`,
-- y por eso devuelve columnas explícitas en vez de `select *`: agregar una
-- columna sensible a member_details no la filtra acá por accidente.
-- ===========================================================================
create or replace function public.emergency_card()
returns table (
  member_id       uuid,
  display_name    text,
  color           text,
  birth_date      date,
  blood_type      text,
  allergies       text,
  conditions      text,
  emergency_notes text,
  medications     text[]
)
language sql
stable
security definer
set search_path = public
as $$
  select
    m.id,
    m.display_name,
    m.color,
    m.birth_date,
    d.blood_type,
    d.allergies,
    d.conditions,
    d.emergency_notes,
    coalesce(
      array(
        select med.name || coalesce(' (' || med.dose || ')', '')
        from public.medications med
        where med.member_id = m.id and med.is_active
        order by med.name
      ),
      '{}'::text[]
    )
  from public.family_members m
  left join public.member_details d on d.member_id = m.id
  where m.family_id = public.auth_family_id()
    and not m.is_archived
  order by m.position;
$$;

revoke execute on function public.emergency_card() from anon, public;
grant execute on function public.emergency_card() to authenticated;
