-- ===========================================================================
-- Generación de ocurrencias.
--
-- ensure_task_instances() es idempotente: el planner la llama en cada carga y
-- el `unique (task_id, due_date)` absorbe lo ya generado. Su gemela en
-- TypeScript es src/lib/tasks/recurrence.ts, que hace el mismo cálculo para
-- previsualizar "próximas fechas" al crear la tarea.
-- LAS DOS TIENEN QUE CAMBIAR JUNTAS.
-- ===========================================================================

/**
 * Materializa las ocurrencias de todas las tareas recurrentes de una familia
 * hasta p_until. Devuelve cuántas creó.
 *
 * p_family_id solo lo usa el cron (service role), que no tiene JWT. Un usuario
 * autenticado siempre opera sobre su propia familia y el parámetro se ignora.
 */
create or replace function public.ensure_task_instances(
  p_until     date,
  p_family_id uuid default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family   uuid;
  v_until    date;
  v_task     record;
  v_freq     text;
  v_interval integer;
  v_weekdays integer[];
  v_monthday integer;
  v_last     date;
  v_seq      integer;
  v_cursor   date;
  v_month    date;
  v_dates    date[];
  v_due      date;
  v_assignee uuid;
  v_len      integer;
  v_created  integer := 0;
begin
  if public.auth_family_id() is not null then
    v_family := public.auth_family_id();
  elsif coalesce(auth.role(), '') = 'service_role' and p_family_id is not null then
    v_family := p_family_id;
  else
    raise exception 'No hay familia en contexto';
  end if;

  -- Techo duro: sin esto, un p_until absurdo genera cientos de miles de filas.
  v_until := least(p_until, current_date + 400);

  for v_task in
    select * from public.tasks
    where family_id = v_family
      and recurrence is not null
      and not is_archived
  loop
    v_freq := v_task.recurrence ->> 'freq';
    v_dates := '{}'::date[];

    select max(due_date), count(*)
      into v_last, v_seq
    from public.task_instances
    where task_id = v_task.id;

    -- --- Fase 1: calcular las fechas candidatas ---------------------------
    if v_freq = 'days' then
      v_interval := (v_task.recurrence ->> 'interval')::integer;
      v_cursor := coalesce(v_last + v_interval, v_task.starts_on);
      while v_cursor <= v_until loop
        v_dates := v_dates || v_cursor;
        v_cursor := v_cursor + v_interval;
      end loop;

    elsif v_freq = 'weekly' then
      -- Alias explícito `as t(value)`: sin el nombre de columna, `value`
      -- resuelve al alias de la tabla y no al texto de cada elemento.
      select array_agg(t.value::integer)
        into v_weekdays
      from jsonb_array_elements_text(v_task.recurrence -> 'byweekday') as t(value);

      v_cursor := greatest(coalesce(v_last + 1, v_task.starts_on), v_task.starts_on);
      while v_cursor <= v_until loop
        if extract(dow from v_cursor)::integer = any (v_weekdays) then
          v_dates := v_dates || v_cursor;
        end if;
        v_cursor := v_cursor + 1;
      end loop;

    elsif v_freq = 'monthly' then
      v_monthday := (v_task.recurrence ->> 'bymonthday')::integer;

      if v_last is null then
        v_month := date_trunc('month', v_task.starts_on::timestamp)::date;
      else
        v_month := (date_trunc('month', v_last::timestamp) + interval '1 month')::date;
      end if;

      while v_month <= v_until loop
        -- "El 31 de cada mes" en febrero cae el 28 (o 29). Recortar al último
        -- día del mes en vez de saltear el mes: la tarea igual hay que hacerla.
        v_due := v_month + (
          least(
            v_monthday,
            extract(day from (v_month + interval '1 month - 1 day'))::integer
          ) - 1
        );
        if v_due >= v_task.starts_on and v_due <= v_until then
          v_dates := v_dates || v_due;
        end if;
        v_month := (v_month + interval '1 month')::date;
      end loop;
    end if;

    -- --- Fase 2: insertar, rotando el responsable -------------------------
    v_len := coalesce(array_length(v_task.rotation_member_ids, 1), 0);

    foreach v_due in array v_dates loop
      if v_len = 0 then
        v_assignee := null;
      else
        -- Rotación determinística por número de ocurrencia: si esta semana le
        -- tocó a mamá, la que viene le toca a papá, sin estado extra que
        -- pueda desincronizarse.
        v_assignee := v_task.rotation_member_ids[1 + (v_seq % v_len)];
      end if;

      insert into public.task_instances (family_id, task_id, due_date, assigned_member_id)
      values (v_family, v_task.id, v_due, v_assignee)
      on conflict (task_id, due_date) do nothing;

      if found then
        v_created := v_created + 1;
        v_seq := v_seq + 1;
      end if;
    end loop;
  end loop;

  return v_created;
end;
$$;

revoke execute on function public.ensure_task_instances(date, uuid) from anon, public;
grant execute on function public.ensure_task_instances(date, uuid) to authenticated, service_role;

/**
 * Una tarea puntual nace con su única ocurrencia, así el planner nunca tiene
 * que preguntarse si una tarea sin instancias existe o no.
 */
create or replace function public.tasks_seed_one_off()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.recurrence is null then
    insert into public.task_instances (family_id, task_id, due_date, assigned_member_id)
    values (
      new.family_id,
      new.id,
      new.starts_on,
      case
        when coalesce(array_length(new.rotation_member_ids, 1), 0) > 0
          then new.rotation_member_ids[1]
        else null
      end
    )
    on conflict (task_id, due_date) do nothing;
  end if;
  return new;
end;
$$;

create trigger tasks_seed_one_off_after_insert
  after insert on public.tasks
  for each row execute function public.tasks_seed_one_off();
