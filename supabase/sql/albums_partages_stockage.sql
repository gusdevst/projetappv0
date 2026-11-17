-- Album partagé : règles du dossier « shared-photos » seulement (à coller seul dans Supabase → SQL Editor, sans risque : peut être relancé).
-- Prérequis : albums_partages.sql déjà lancé (il crée is_shared_album_owner / is_shared_album_member).
insert into storage.buckets (id, name, public)
values ('shared-photos', 'shared-photos', false)
on conflict (id) do nothing;

drop policy if exists "shared-photos: déposer" on storage.objects;
create policy "shared-photos: déposer" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'shared-photos'
              and (storage.foldername(name))[2] = auth.uid()::text
              and public.is_shared_album_member(((storage.foldername(name))[1])::uuid));

drop policy if exists "shared-photos: remplacer" on storage.objects;
create policy "shared-photos: remplacer" on storage.objects
  for update to authenticated
  using (bucket_id = 'shared-photos' and (storage.foldername(name))[2] = auth.uid()::text);

drop policy if exists "shared-photos: lire" on storage.objects;
create policy "shared-photos: lire" on storage.objects
  for select to authenticated
  using (bucket_id = 'shared-photos'
         and ((storage.foldername(name))[2] = auth.uid()::text
              or public.is_shared_album_owner(((storage.foldername(name))[1])::uuid)));

drop policy if exists "shared-photos: effacer" on storage.objects;
create policy "shared-photos: effacer" on storage.objects
  for delete to authenticated
  using (bucket_id = 'shared-photos'
         and ((storage.foldername(name))[2] = auth.uid()::text
              or public.is_shared_album_owner(((storage.foldername(name))[1])::uuid)));

