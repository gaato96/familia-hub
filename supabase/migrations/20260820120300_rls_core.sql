-- ===========================================================================
-- RLS del core.
--
-- Esta es LA frontera de seguridad de la app. El código de aplicación nunca
-- filtra por family_id: si estas policies están bien, una query devuelve
-- exactamente las filas de una familia; si están mal, tests/rls/isolation.test.ts
-- falla antes de que alguien vea los datos de otra casa.
-- ===========================================================================

alter table public.families           enable row level security;
alter table public.profiles           enable row level security;
alter table public.family_members     enable row level security;
alter table public.push_subscriptions enable row level security;

-- ---------------------------------------------------------------------------
-- families — se lee la propia; el alta va solo por create_family()
-- ---------------------------------------------------------------------------
create policy families_select on public.families
  for select to authenticated
  using (id = public.auth_family_id());

create policy families_update on public.families
  for update to authenticated
  using (id = public.auth_family_id() and public.is_parent())
  with check (id = public.auth_family_id() and public.is_parent());

-- Sin policy de INSERT ni DELETE: crear familia es create_family(), y una
-- familia no se borra desde la app.

-- ---------------------------------------------------------------------------
-- profiles — visibles dentro de la casa; el rol solo se toca vía RPC
-- ---------------------------------------------------------------------------
create policy profiles_select on public.profiles
  for select to authenticated
  using (family_id = public.auth_family_id() or id = auth.uid());

-- Sin UPDATE directo: `role` e `is_active` son permisos, y set_member_role()
-- es el único camino (impide que un child se auto-promueva escribiendo la fila).

-- ---------------------------------------------------------------------------
-- family_members — todos ven a todos; cada uno edita su propia ficha
-- ---------------------------------------------------------------------------
create policy family_members_select on public.family_members
  for select to authenticated
  using (family_id = public.auth_family_id());

create policy family_members_insert on public.family_members
  for insert to authenticated
  with check (family_id = public.auth_family_id() and public.is_parent());

create policy family_members_update on public.family_members
  for update to authenticated
  using (
    family_id = public.auth_family_id()
    and (public.is_parent() or profile_id = auth.uid())
  )
  with check (
    family_id = public.auth_family_id()
    and (public.is_parent() or profile_id = auth.uid())
  );

create policy family_members_delete on public.family_members
  for delete to authenticated
  using (family_id = public.auth_family_id() and public.is_parent());

-- ---------------------------------------------------------------------------
-- push_subscriptions — estrictamente propias del dispositivo de cada uno
-- ---------------------------------------------------------------------------
create policy push_subscriptions_select on public.push_subscriptions
  for select to authenticated
  using (profile_id = auth.uid());

create policy push_subscriptions_insert on public.push_subscriptions
  for insert to authenticated
  with check (profile_id = auth.uid() and family_id = public.auth_family_id());

create policy push_subscriptions_update on public.push_subscriptions
  for update to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

create policy push_subscriptions_delete on public.push_subscriptions
  for delete to authenticated
  using (profile_id = auth.uid());
