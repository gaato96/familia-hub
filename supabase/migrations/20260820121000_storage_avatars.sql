-- ===========================================================================
-- Storage: avatares.
--
-- El bucket es PRIVADO aunque una foto de perfil no sea un documento legal.
-- Motivo: la convención de rutas y las policies son las mismas que va a usar
-- `family-docs` en la Fase 2 (DNI, estudios médicos). Tener un solo patrón —
-- todo privado, todo por URL firmada — evita que algún día alguien copie el
-- de avatares creyendo que sirve para un carnet de vacunas.
--
-- Convención de ruta: {family_id}/{member_id}/{uuid}.{ext}
-- El primer segmento SIEMPRE es el family_id: es lo que la policy compara.
-- ===========================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  false,
  2 * 1024 * 1024,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

/**
 * Extrae el family_id del primer segmento de la ruta.
 *
 * Devuelve null si no parece un uuid en vez de reventar: un objeto con ruta
 * mal formada tiene que quedar invisible, no tirar un error 500 que rompa el
 * listado entero.
 */
create or replace function public.storage_family_id(p_name text)
returns uuid
language sql
stable
as $$
  select case
    when (storage.foldername(p_name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then ((storage.foldername(p_name))[1])::uuid
    else null
  end;
$$;

create policy avatars_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'avatars'
    and public.storage_family_id(name) = public.auth_family_id()
  );

create policy avatars_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and public.storage_family_id(name) = public.auth_family_id()
  );

create policy avatars_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatars'
    and public.storage_family_id(name) = public.auth_family_id()
  );

create policy avatars_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatars'
    and public.storage_family_id(name) = public.auth_family_id()
  );
