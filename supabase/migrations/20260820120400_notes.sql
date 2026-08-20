-- ===========================================================================
-- "La Heladera": notas adhesivas en vivo.
--
-- Decisión de modelo: NO se guardan coordenadas x/y libres. Un corcho con
-- posicionamiento libre es lindo en una pantalla de escritorio e inusable en
-- un teléfono en vertical — las notas se pisan y quedan fuera del viewport.
-- En su lugar hay un orden (`position`, reordenable arrastrando) y una
-- `rotation` chica que da el efecto de papelito pegado torcido sin romper el
-- layout responsive.
-- ===========================================================================

create table public.notes (
  id               uuid primary key default gen_random_uuid(),
  family_id        uuid not null references public.families(id) on delete cascade,
  author_member_id uuid not null references public.family_members(id) on delete cascade,
  body             text not null check (length(trim(body)) between 1 and 500),
  color            text not null default 'yellow'
                   check (color in ('yellow', 'pink', 'blue', 'green', 'orange', 'purple')),
  -- Grados. El rango chico es a propósito: más que esto y el texto se lee mal.
  rotation         numeric(3, 1) not null default 0 check (rotation between -6 and 6),
  position         integer not null default 0,
  is_pinned        boolean not null default false,
  -- Una nota puede autodestruirse ("compré pan, ya está"). null = queda.
  expires_at       timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index notes_family_board_idx
  on public.notes (family_id, is_pinned desc, position, created_at desc);

create trigger notes_updated_at
  before update on public.notes
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Lecturas y reacciones
-- ---------------------------------------------------------------------------
create table public.note_reads (
  note_id   uuid not null references public.notes(id) on delete cascade,
  member_id uuid not null references public.family_members(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  read_at   timestamptz not null default now(),
  primary key (note_id, member_id)
);

create index note_reads_member_idx on public.note_reads (member_id);

create table public.note_reactions (
  note_id    uuid not null references public.notes(id) on delete cascade,
  member_id  uuid not null references public.family_members(id) on delete cascade,
  family_id  uuid not null references public.families(id) on delete cascade,
  emoji      text not null check (emoji in ('❤️', '👍', '😂', '👀', '🎉')),
  created_at timestamptz not null default now(),
  primary key (note_id, member_id, emoji)
);

-- ---------------------------------------------------------------------------
-- RLS: el tablero de la heladera lo ve y lo escribe cualquiera de la casa —
-- incluidos los chicos. Borrar la nota de otro queda para los adultos.
-- ---------------------------------------------------------------------------
alter table public.notes          enable row level security;
alter table public.note_reads     enable row level security;
alter table public.note_reactions enable row level security;

create policy notes_select on public.notes
  for select to authenticated
  using (family_id = public.auth_family_id());

create policy notes_insert on public.notes
  for insert to authenticated
  with check (
    family_id = public.auth_family_id()
    and author_member_id in (
      select id from public.family_members
      where family_id = public.auth_family_id()
    )
  );

create policy notes_update on public.notes
  for update to authenticated
  using (family_id = public.auth_family_id())
  with check (family_id = public.auth_family_id());

create policy notes_delete on public.notes
  for delete to authenticated
  using (
    family_id = public.auth_family_id()
    and (
      public.is_parent()
      or author_member_id in (
        select id from public.family_members where profile_id = auth.uid()
      )
    )
  );

create policy note_reads_select on public.note_reads
  for select to authenticated
  using (family_id = public.auth_family_id());

create policy note_reads_insert on public.note_reads
  for insert to authenticated
  with check (
    family_id = public.auth_family_id()
    and member_id in (select id from public.family_members where profile_id = auth.uid())
  );

create policy note_reactions_select on public.note_reactions
  for select to authenticated
  using (family_id = public.auth_family_id());

create policy note_reactions_insert on public.note_reactions
  for insert to authenticated
  with check (
    family_id = public.auth_family_id()
    and member_id in (select id from public.family_members where profile_id = auth.uid())
  );

create policy note_reactions_delete on public.note_reactions
  for delete to authenticated
  using (
    family_id = public.auth_family_id()
    and member_id in (select id from public.family_members where profile_id = auth.uid())
  );

-- Realtime: es lo que hace que una nota aparezca en el otro teléfono sin
-- recargar. El cliente igual poll-ea cada 30s — ver src/hooks/use-notes-realtime.ts.
alter publication supabase_realtime add table public.notes;
