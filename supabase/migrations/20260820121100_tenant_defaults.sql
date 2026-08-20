-- ===========================================================================
-- family_id lo pone la base, no el cliente.
--
-- Toda tabla de tenant tiene family_id NOT NULL, así que sin esto cada insert
-- del front tendría que mandarlo a mano. Eso es un problema de diseño, no una
-- molestia: el día que alguien mande el family_id equivocado, la policy lo
-- rechaza — pero mientras tanto el código de la app estuvo decidiendo tenant,
-- que es justo lo que la regla "la app nunca filtra por family_id" evita.
--
-- Un trigger BEFORE INSERT corre ANTES de que se chequee el NOT NULL, así que
-- la columna puede seguir siendo obligatoria y el cliente puede omitirla.
-- ===========================================================================

create or replace function public.set_family_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.family_id is null then
    new.family_id := public.auth_family_id();
  end if;

  if new.family_id is null then
    raise exception 'No hay familia en el contexto de la sesión';
  end if;

  return new;
end;
$$;

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    -- family_members incluida: create_family() y join_family() mandan el
    -- family_id explícito (el trigger solo completa cuando viene null), pero
    -- agregar a Julián desde la pantalla de la familia es un insert normal
    -- del cliente y no tiene por qué saber de qué familia es.
    'family_members',
    'notes', 'note_reads', 'note_reactions',
    'tasks', 'task_steps', 'events', 'event_attendees',
    'shopping_lists', 'shopping_items'
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

-- ---------------------------------------------------------------------------
-- Autoría: quién escribió la nota / creó la tarea también sale de la sesión.
--
-- Mismo criterio. Además evita el caso incómodo de que alguien firme una nota
-- como otro integrante: no es un agujero grave en una app familiar, pero deja
-- el historial de "quién dijo qué" en algo que se puede creer.
-- ---------------------------------------------------------------------------
create or replace function public.set_author_member()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_column text := tg_argv[0];
  v_member uuid := public.auth_member_id();
begin
  if v_member is null then
    return new;
  end if;

  -- to_jsonb/jsonb_populate_record: la única forma de escribir una columna
  -- cuyo nombre llega como parámetro sin escribir un trigger por tabla.
  if (to_jsonb(new) ->> v_column) is null then
    new := jsonb_populate_record(new, jsonb_build_object(v_column, v_member));
  end if;

  return new;
end;
$$;

create trigger notes_set_author
  before insert on public.notes
  for each row execute function public.set_author_member('author_member_id');

create trigger tasks_set_author
  before insert on public.tasks
  for each row execute function public.set_author_member('created_by_member_id');

create trigger events_set_author
  before insert on public.events
  for each row execute function public.set_author_member('created_by_member_id');

create trigger shopping_items_set_author
  before insert on public.shopping_items
  for each row execute function public.set_author_member('added_by_member_id');
