-- ===========================================================================
-- RLS del planner.
--
-- Criterio: cualquiera de la casa CREA y COMPLETA (si no, un chico no puede
-- marcar que sacó la basura y la app deja de servir). Solo un adulto BORRA o
-- reescribe lo que armó otro.
-- ===========================================================================

alter table public.tasks           enable row level security;
alter table public.task_steps      enable row level security;
alter table public.task_instances  enable row level security;
alter table public.events          enable row level security;
alter table public.event_attendees enable row level security;

/** El family_member del usuario con sesión. Se usa en varias policies. */
create or replace function public.auth_member_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.family_members where profile_id = auth.uid() limit 1;
$$;

-- --- tasks ------------------------------------------------------------------
create policy tasks_select on public.tasks
  for select to authenticated
  using (family_id = public.auth_family_id());

create policy tasks_insert on public.tasks
  for insert to authenticated
  with check (family_id = public.auth_family_id());

create policy tasks_update on public.tasks
  for update to authenticated
  using (
    family_id = public.auth_family_id()
    and (public.is_parent() or created_by_member_id = public.auth_member_id())
  )
  with check (family_id = public.auth_family_id());

create policy tasks_delete on public.tasks
  for delete to authenticated
  using (
    family_id = public.auth_family_id()
    and (public.is_parent() or created_by_member_id = public.auth_member_id())
  );

-- --- task_steps -------------------------------------------------------------
create policy task_steps_select on public.task_steps
  for select to authenticated
  using (family_id = public.auth_family_id());

create policy task_steps_write on public.task_steps
  for all to authenticated
  using (family_id = public.auth_family_id())
  with check (family_id = public.auth_family_id());

-- --- task_instances ---------------------------------------------------------
-- Se generan por ensure_task_instances() (security definer), así que no hay
-- policy de INSERT: nadie inventa una ocurrencia a mano.
create policy task_instances_select on public.task_instances
  for select to authenticated
  using (family_id = public.auth_family_id());

create policy task_instances_update on public.task_instances
  for update to authenticated
  using (family_id = public.auth_family_id())
  with check (family_id = public.auth_family_id());

create policy task_instances_delete on public.task_instances
  for delete to authenticated
  using (family_id = public.auth_family_id() and public.is_parent());

-- --- events -----------------------------------------------------------------
create policy events_select on public.events
  for select to authenticated
  using (family_id = public.auth_family_id());

create policy events_insert on public.events
  for insert to authenticated
  with check (family_id = public.auth_family_id());

create policy events_update on public.events
  for update to authenticated
  using (
    family_id = public.auth_family_id()
    and (public.is_parent() or created_by_member_id = public.auth_member_id())
  )
  with check (family_id = public.auth_family_id());

create policy events_delete on public.events
  for delete to authenticated
  using (
    family_id = public.auth_family_id()
    and (public.is_parent() or created_by_member_id = public.auth_member_id())
  );

-- --- event_attendees --------------------------------------------------------
create policy event_attendees_select on public.event_attendees
  for select to authenticated
  using (family_id = public.auth_family_id());

create policy event_attendees_write on public.event_attendees
  for all to authenticated
  using (family_id = public.auth_family_id())
  with check (family_id = public.auth_family_id());

-- Realtime en las ocurrencias: si alguien tilda "baño limpio" desde la cocina,
-- el otro teléfono lo ve sin recargar.
alter publication supabase_realtime add table public.task_instances;
