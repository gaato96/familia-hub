-- ===========================================================================
-- Storage: caja fuerte documental.
--
-- Bucket PRIVADO. Nunca se sirve una URL pública: la lectura es siempre por
-- URL firmada de corta duración generada en el servidor. Acá adentro va el DNI
-- de un menor y su historia clínica.
--
-- Convención de ruta, la misma que en `avatars`:
--   {family_id}/{member_id|_casa}/{uuid}.{ext}
-- El primer segmento es lo único que la policy compara — ver
-- public.storage_family_id() en 20260820121000_storage_avatars.sql.
--
-- El límite de 15 MB no es arbitrario: una foto de celular comprimida a WebP
-- ronda los 300 KB y un PDF de estudios escaneado rara vez pasa los 10 MB.
-- Más que eso, en el free tier de 1 GB, es alguien subiendo un video por error.
-- ===========================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'family-docs',
  'family-docs',
  false,
  15 * 1024 * 1024,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'application/pdf'
  ]
)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Los documentos son parte del expediente: solo adultos.
--
-- Una foto de perfil la puede ver cualquiera (bucket `avatars`); un carnet de
-- vacunas no. Por eso este bucket repite el patrón de rutas pero suma
-- `is_parent()` — es la misma diferencia que hay entre las policies de
-- `contacts` y las del resto del expediente.
-- ---------------------------------------------------------------------------
create policy family_docs_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'family-docs'
    and public.storage_family_id(name) = public.auth_family_id()
    and public.is_parent()
  );

create policy family_docs_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'family-docs'
    and public.storage_family_id(name) = public.auth_family_id()
    and public.is_parent()
  );

create policy family_docs_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'family-docs'
    and public.storage_family_id(name) = public.auth_family_id()
    and public.is_parent()
  );

create policy family_docs_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'family-docs'
    and public.storage_family_id(name) = public.auth_family_id()
    and public.is_parent()
  );
