-- supabase/sql/albums_partages.sql
-- Albums partagés : à COLLER dans Supabase → SQL Editor → Run.
-- Sûr à relancer : « if not exists », « create or replace », « drop policy if exists ».
--
-- Le principe (maquette Claude outputs/maquette-album-partage.html) :
--   - le propriétaire partage un de ses albums → un CODE à 6 caractères est créé PAR LE SERVEUR ;
--   - un invité (compte obligatoire) tape le code → il devient membre ;
--   - l'invité envoie des photos → elles attendent dans la « boîte aux lettres » (statut pending) ;
--   - le propriétaire swipe : gardée (kept) ou refusée (refused) → le fichier est alors effacé du stockage
--     (la ligne reste, sans fichier : elle sert au compteur « 34 photos envoyées » et à ne jamais renvoyer une photo).
--
-- Ce que ça crée :
--   1. `shared_albums`          : un album partagé (code, propriétaire, nom)
--   2. `shared_album_members`   : qui a rejoint quel album
--   3. `shared_photos`          : chaque photo envoyée (fichier, dimensions, date, statut)
--   4. `shared_album_join_attempts` : les essais de code (anti « on essaie tous les codes »)
--   5. les fonctions appelées par l'app : créer / rejoindre / changer le code / renommer
--   6. le dossier privé `shared-photos` : <id album>/<id expéditeur>/<id photo>.<ext>
--   7. la sécurité (RLS)
--
-- Règle d'or : PERSONNE ne peut lire la liste des codes. On ne peut que tenter un code via join_shared_album().

-- ── 1. Albums partagés ────────────────────────────────────────────────────────
create table if not exists public.shared_albums (
  id               uuid primary key default gen_random_uuid(),
  owner_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  owner_name       text not null,                    -- prénom affiché aux invités (« Album d'Augustin »)
  local_album_id   text not null,                    -- id de l'album sur le téléphone du propriétaire
  name             text not null,                    -- « L'été 2026 »
  code             text not null unique,             -- K7P2QX (créé par le serveur)
  code_expires_at  timestamptz,                      -- null = pas de date limite
  max_members      int  not null default 10,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (owner_id, local_album_id)                  -- un album du téléphone = un seul album partagé
);

-- ── 2. Membres (invités) ──────────────────────────────────────────────────────
create table if not exists public.shared_album_members (
  album_id      uuid not null references public.shared_albums (id) on delete cascade,
  user_id       uuid not null references auth.users (id) on delete cascade,
  display_name  text not null,                       -- prénom affiché au propriétaire (« Léa »)
  joined_at     timestamptz not null default now(),
  primary key (album_id, user_id)
);

-- ── 3. Photos envoyées ────────────────────────────────────────────────────────
create table if not exists public.shared_photos (
  id               uuid primary key default gen_random_uuid(),
  album_id         uuid not null references public.shared_albums (id) on delete cascade,
  sender_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  sender_asset_id  text not null,                    -- id de la photo sur le téléphone de l'invité (jamais renvoyée deux fois)
  batch_id         uuid not null,                    -- un « Envoyer 34 photos » = un lot
  path             text,                             -- chemin dans shared-photos (null une fois triée = fichier effacé)
  mime             text,
  width            int,
  height           int,
  bytes            bigint,
  taken_at         timestamptz,                      -- date de prise de vue (affichée au tri, et pour le livre)
  status           text not null default 'pending' check (status in ('pending', 'kept', 'refused')),
  decided_at       timestamptz,
  created_at       timestamptz not null default now(),
  unique (album_id, sender_id, sender_asset_id)
);

create index if not exists shared_photos_album_status on public.shared_photos (album_id, status);

-- ── 4. Essais de code ─────────────────────────────────────────────────────────
create table if not exists public.shared_album_join_attempts (
  id       bigint generated always as identity primary key,
  user_id  uuid not null,
  ok       boolean not null,
  at       timestamptz not null default now()
);
create index if not exists join_attempts_user_at on public.shared_album_join_attempts (user_id, at);
alter table public.shared_album_join_attempts enable row level security;  -- aucune règle = personne ne lit (seules les fonctions écrivent)

-- ── 5. Petites fonctions d'aide (évitent que les règles RLS se mordent la queue) ──
create or replace function public.is_shared_album_owner(p_album uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.shared_albums where id = p_album and owner_id = auth.uid());
$$;

create or replace function public.is_shared_album_member(p_album uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.shared_album_members where album_id = p_album and user_id = auth.uid());
$$;

-- Un code au hasard : 6 caractères, sans 0 / O / 1 / I / L (ceux qui se confondent).
create or replace function public.new_shared_album_code()
returns text language plpgsql volatile security definer set search_path = public as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  c text;
begin
  loop
    c := '';
    for i in 1..6 loop
      c := c || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.shared_albums where code = c);
  end loop;
  return c;
end;
$$;

-- ── Fonctions appelées par l'app ─────────────────────────────────────────────

-- Partager un album du téléphone (ou retrouver son partage s'il existe déjà).
create or replace function public.create_shared_album(p_local_album_id text, p_name text, p_owner_name text)
returns public.shared_albums language plpgsql volatile security definer set search_path = public as $$
declare r public.shared_albums;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  select * into r from public.shared_albums where owner_id = auth.uid() and local_album_id = p_local_album_id;
  if found then return r; end if;
  insert into public.shared_albums (owner_id, owner_name, local_album_id, name, code)
  values (auth.uid(), trim(p_owner_name), p_local_album_id, trim(p_name), public.new_shared_album_code())
  returning * into r;
  return r;
end;
$$;

-- « Changer le code » : l'ancien ne marche plus (les membres déjà entrés restent).
create or replace function public.regenerate_shared_album_code(p_album uuid)
returns text language plpgsql volatile security definer set search_path = public as $$
declare c text;
begin
  if not public.is_shared_album_owner(p_album) then raise exception 'not_owner'; end if;
  c := public.new_shared_album_code();
  update public.shared_albums set code = c, updated_at = now() where id = p_album;
  return c;
end;
$$;

-- Renommer (quand le propriétaire renomme son album sur le téléphone).
create or replace function public.rename_shared_album(p_album uuid, p_name text)
returns void language plpgsql volatile security definer set search_path = public as $$
begin
  if not public.is_shared_album_owner(p_album) then raise exception 'not_owner'; end if;
  update public.shared_albums set name = trim(p_name), updated_at = now() where id = p_album;
end;
$$;

-- Rejoindre avec un code. Succès : { album_id, name, owner_name, members }.
-- Échec : soit { error: 'unknown_code' } (réponse normale, pour que l'essai soit bien compté),
--         soit une exception (l'app les traduit) : not_signed_in · too_many_attempts · expired · own_album · full
create or replace function public.join_shared_album(p_code text, p_name text)
returns json language plpgsql volatile security definer set search_path = public as $$
declare
  r public.shared_albums;
  clean text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  fails int;
  n int;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;

  -- 10 mauvais codes par heure maximum.
  select count(*) into fails from public.shared_album_join_attempts
   where user_id = auth.uid() and not ok and at > now() - interval '1 hour';
  if fails >= 10 then raise exception 'too_many_attempts'; end if;

  select * into r from public.shared_albums where code = clean;
  if not found then
    -- On RENVOIE l'erreur (au lieu de « raise exception ») : une exception annulerait aussi cette ligne
    -- et le compteur d'essais ne bougerait jamais.
    insert into public.shared_album_join_attempts (user_id, ok) values (auth.uid(), false);
    return json_build_object('error', 'unknown_code');
  end if;
  if r.code_expires_at is not null and r.code_expires_at < now() then raise exception 'expired'; end if;
  if r.owner_id = auth.uid() then raise exception 'own_album'; end if;

  if not exists (select 1 from public.shared_album_members where album_id = r.id and user_id = auth.uid()) then
    select count(*) into n from public.shared_album_members where album_id = r.id;
    if n >= r.max_members then raise exception 'full'; end if;
    insert into public.shared_album_members (album_id, user_id, display_name)
    values (r.id, auth.uid(), trim(p_name));
  end if;
  insert into public.shared_album_join_attempts (user_id, ok) values (auth.uid(), true);

  select count(*) into n from public.shared_album_members where album_id = r.id;
  return json_build_object('album_id', r.id, 'name', r.name, 'owner_name', r.owner_name, 'members', n);
end;
$$;

grant execute on function public.create_shared_album(text, text, text)    to authenticated;
grant execute on function public.regenerate_shared_album_code(uuid)        to authenticated;
grant execute on function public.rename_shared_album(uuid, text)           to authenticated;
grant execute on function public.join_shared_album(text, text)             to authenticated;
revoke execute on function public.new_shared_album_code() from public, anon, authenticated;

-- ── 7. Sécurité (RLS) ─────────────────────────────────────────────────────────
alter table public.shared_albums        enable row level security;
alter table public.shared_album_members enable row level security;
alter table public.shared_photos        enable row level security;

-- Albums : le propriétaire et les membres les voient. Création / changement = fonctions seulement.
drop policy if exists "shared_albums: voir" on public.shared_albums;
create policy "shared_albums: voir" on public.shared_albums
  for select to authenticated
  using (owner_id = auth.uid() or public.is_shared_album_member(id));

drop policy if exists "shared_albums: arrêter le partage" on public.shared_albums;
create policy "shared_albums: arrêter le partage" on public.shared_albums
  for delete to authenticated using (owner_id = auth.uid());

-- Membres : le propriétaire voit tout le monde ; un invité ne voit que sa propre ligne (V1).
drop policy if exists "members: voir" on public.shared_album_members;
create policy "members: voir" on public.shared_album_members
  for select to authenticated
  using (user_id = auth.uid() or public.is_shared_album_owner(album_id));

-- Quitter (soi-même) ou retirer quelqu'un (propriétaire).
drop policy if exists "members: quitter ou retirer" on public.shared_album_members;
create policy "members: quitter ou retirer" on public.shared_album_members
  for delete to authenticated
  using (user_id = auth.uid() or public.is_shared_album_owner(album_id));

-- Photos : l'invité voit les siennes, le propriétaire voit tout son album.
drop policy if exists "shared_photos: voir" on public.shared_photos;
create policy "shared_photos: voir" on public.shared_photos
  for select to authenticated
  using (sender_id = auth.uid() or public.is_shared_album_owner(album_id));

-- Envoyer : seulement un membre, seulement « pending ».
drop policy if exists "shared_photos: envoyer" on public.shared_photos;
create policy "shared_photos: envoyer" on public.shared_photos
  for insert to authenticated
  with check (sender_id = auth.uid() and status = 'pending' and decided_at is null
              and public.is_shared_album_member(album_id));

-- L'invité peut compléter le chemin du fichier tant que la photo attend (reprise d'envoi).
drop policy if exists "shared_photos: compléter mon envoi" on public.shared_photos;
create policy "shared_photos: compléter mon envoi" on public.shared_photos
  for update to authenticated
  using (sender_id = auth.uid() and status = 'pending')
  with check (sender_id = auth.uid() and status = 'pending' and public.is_shared_album_member(album_id));

-- Trier : seul le propriétaire passe une photo en kept / refused.
drop policy if exists "shared_photos: trier" on public.shared_photos;
create policy "shared_photos: trier" on public.shared_photos
  for update to authenticated
  using (public.is_shared_album_owner(album_id))
  with check (public.is_shared_album_owner(album_id));

-- Retirer une photo pas encore triée (l'invité) ou n'importe laquelle (le propriétaire).
drop policy if exists "shared_photos: retirer" on public.shared_photos;
create policy "shared_photos: retirer" on public.shared_photos
  for delete to authenticated
  using ((sender_id = auth.uid() and status = 'pending') or public.is_shared_album_owner(album_id));

-- ── 6. Dossier des photos (privé) ────────────────────────────────────────────
-- Chemin : <id album>/<id expéditeur>/<id photo>.<ext>
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

-- PAS ENCORE : effacement automatique des photos non triées après 30 jours (une fonction serveur planifiée ;
-- le SQL seul ne retire pas les fichiers du stockage).
