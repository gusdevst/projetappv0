-- supabase/sql/print_orders.sql
-- Commandes de tirages (abonnement « Coups de cœur ») : à COLLER dans Supabase → SQL Editor → Run.
-- Sûr à relancer : tout est « if not exists » / « drop policy if exists ».
--
-- Ce que ça crée :
--   1. la table `print_orders` : une ligne par sélection validée (abonnement + mois)
--   2. le dossier de stockage privé `print-photos` : les photos à imprimer, rangées par compte
--   3. la sécurité (RLS) : chaque compte ne voit / n'envoie que ses propres commandes et photos
--
-- Pour imprimer à la main : Table Editor → print_orders (adresse, nom, petit mot, chemins des photos),
-- Storage → print-photos (télécharger les photos). Quand tu avances, change la colonne `status`
-- (validated → printing → shipped → delivered) : le suivi dans l'app suit tout seul.

-- ── 1. La table ───────────────────────────────────────────────────────────────
create table if not exists public.print_orders (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  sub_id      text not null,                       -- id de l'abonnement sur le téléphone
  month       text not null,                       -- "2026-11"
  kind        text not null check (kind in ('self', 'gift')),
  recipient   text not null,                       -- nom sur l'enveloppe
  address     text not null,                       -- adresse (2e ligne = complément)
  message     text,                                -- petit mot (pour un proche)
  photo_count int  not null check (photo_count > 0),
  photos      jsonb not null,                      -- chemins dans le dossier print-photos
  photo_info  jsonb,                               -- par photo : chemin, largeur / hauteur (px), forme (portrait · landscape · square)
  product     text not null default 'prints' check (product in ('prints', 'magnets')),  -- tirages 10x15 ou magnets 5x5
  spec        jsonb,                               -- ce que l'imprimeur doit produire (mm, recadrage…)
  status      text not null default 'validated'
              check (status in ('validated', 'printing', 'shipped', 'delivered')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, sub_id, month)
);

-- Table déjà créée avant ? On ajoute les colonnes manquantes (sans effet si elles existent).
alter table public.print_orders add column if not exists product text not null default 'prints';
alter table public.print_orders add column if not exists spec jsonb;
alter table public.print_orders add column if not exists photo_info jsonb;  -- dimensions + forme de chaque photo
do $$ begin
  alter table public.print_orders add constraint print_orders_product_check check (product in ('prints', 'magnets'));
exception when duplicate_object then null; end $$;

alter table public.print_orders enable row level security;

drop policy if exists "print_orders: voir les siennes" on public.print_orders;
create policy "print_orders: voir les siennes" on public.print_orders
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "print_orders: créer la sienne" on public.print_orders;
create policy "print_orders: créer la sienne" on public.print_orders
  for insert to authenticated with check (user_id = auth.uid() and status = 'validated');

-- Renvoi possible tant que la commande n'est pas prise en charge (jamais de changement de statut côté app).
drop policy if exists "print_orders: renvoyer tant que validée" on public.print_orders;
create policy "print_orders: renvoyer tant que validée" on public.print_orders
  for update to authenticated
  using (user_id = auth.uid() and status = 'validated')
  with check (user_id = auth.uid() and status = 'validated');

-- ── 2. Le dossier de photos (privé) ──────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('print-photos', 'print-photos', false)
on conflict (id) do nothing;

-- ── 3. Sécurité du dossier : chacun dans son sous-dossier <id du compte>/… ───
drop policy if exists "print-photos: déposer dans son dossier" on storage.objects;
create policy "print-photos: déposer dans son dossier" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'print-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "print-photos: remplacer dans son dossier" on storage.objects;
create policy "print-photos: remplacer dans son dossier" on storage.objects
  for update to authenticated
  using (bucket_id = 'print-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "print-photos: lire son dossier" on storage.objects;
create policy "print-photos: lire son dossier" on storage.objects
  for select to authenticated
  using (bucket_id = 'print-photos' and (storage.foldername(name))[1] = auth.uid()::text);
