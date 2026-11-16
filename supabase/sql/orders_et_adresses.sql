-- supabase/sql/orders_et_adresses.sql
-- Adresses du compte + commandes de livres photo : à COLLER dans Supabase → SQL Editor → Run.
-- Sûr à relancer : tout est « if not exists » / « drop policy if exists ».
--
-- Ce que ça crée :
--   1. `addresses`  : les adresses de livraison enregistrées dans le compte (une seule « par défaut »)
--   2. `orders`     : une ligne par commande de livre (adresse RECOPIÉE au moment de l'achat, fichier, statut, suivi)
--   3. le dossier privé `print-files` : le PDF du livre, rangé par compte (<id du compte>/<id commande>.pdf)
--   4. la sécurité (RLS) : chaque compte ne voit / ne modifie que ses adresses et ses commandes
--
-- Le PRIX n'est jamais écrit par l'app : la fonction `imprimeur-order` le recalcule côté serveur.
-- Le statut « transmitted » et la suite (printed, mailed, delivered) ne sont posés que par cette fonction.

-- ── 1. Adresses ───────────────────────────────────────────────────────────────
create table if not exists public.addresses (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  label       text not null default 'Chez moi',     -- nom de l'adresse (« Chez Maman »…)
  name        text not null,                        -- prénom et nom du destinataire
  street      text not null,                        -- numéro et rue
  complement  text,                                 -- bâtiment, étage, code…
  postal_code text not null,
  city        text not null,
  country     text not null default 'FR',
  phone       text not null,
  is_default  boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Une seule adresse par défaut par compte.
create unique index if not exists addresses_one_default_per_user
  on public.addresses (user_id) where is_default;

alter table public.addresses enable row level security;

drop policy if exists "addresses: voir les siennes" on public.addresses;
create policy "addresses: voir les siennes" on public.addresses
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "addresses: créer la sienne" on public.addresses;
create policy "addresses: créer la sienne" on public.addresses
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "addresses: modifier la sienne" on public.addresses;
create policy "addresses: modifier la sienne" on public.addresses
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "addresses: supprimer la sienne" on public.addresses;
create policy "addresses: supprimer la sienne" on public.addresses
  for delete to authenticated using (user_id = auth.uid());

-- ── 2. Commandes de livres ────────────────────────────────────────────────────
create sequence if not exists public.orders_ref_seq;

create table if not exists public.orders (
  id              uuid primary key default gen_random_uuid(),
  ref             text not null unique default ('PEL-' || lpad(nextval('public.orders_ref_seq')::text, 4, '0')),
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind            text not null default 'book' check (kind in ('book')),
  album_id        text,                              -- id de l'album sur le téléphone (pour reprendre une commande interrompue)
  title           text not null default '',          -- titre du livre (affichage)
  product         text not null check (product in ('a4', 'paysage')),
  pages           int  not null check (pages between 24 and 120 and pages % 2 = 0),
  address         jsonb not null,                    -- COPIE de l'adresse au moment de l'achat : { name, street, complement, postal_code, city, country, phone }
  consent_at      timestamptz not null default now(),-- accord « mes photos sont envoyées à Pellicule et à l'imprimeur »
  file_path       text,                              -- chemin du PDF dans le dossier print-files
  status          text not null default 'draft'
                  check (status in ('draft', 'file_ready', 'failed', 'transmitted', 'printed', 'mailed', 'delivered', 'cancelled')),
  price_cents     int,                               -- prix de vente TTC, posé par la fonction serveur
  supplier        text,                              -- « imprimeur »
  supplier_ref    text,                              -- référence chez l'imprimeur (CMD-2026-123)
  tracking_number text,
  test            boolean not null default true,     -- true = commande de répétition (clé impr_test_)
  error           text,                              -- dernière erreur (affichage / diagnostic)
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.orders enable row level security;

drop policy if exists "orders: voir les siennes" on public.orders;
create policy "orders: voir les siennes" on public.orders
  for select to authenticated using (user_id = auth.uid());

-- L'app crée la commande en « draft » seulement (jamais de prix ni de statut avancé écrits par le téléphone).
drop policy if exists "orders: créer la sienne" on public.orders;
create policy "orders: créer la sienne" on public.orders
  for insert to authenticated
  with check (user_id = auth.uid() and status = 'draft' and price_cents is null and supplier_ref is null);

-- L'app peut seulement faire passer draft → file_ready (le PDF est envoyé) tant que la commande n'est pas transmise.
drop policy if exists "orders: préparer la sienne" on public.orders;
create policy "orders: préparer la sienne" on public.orders
  for update to authenticated
  using (user_id = auth.uid() and status in ('draft', 'file_ready', 'failed'))
  with check (user_id = auth.uid() and status in ('draft', 'file_ready') and price_cents is null and supplier_ref is null);

-- Abandonner une commande jamais transmise à l'imprimeur (brouillon, « à transmettre », « à reprendre »).
-- Une commande transmise (supplier_ref posé) ne se supprime JAMAIS depuis l'app.
drop policy if exists "orders: supprimer un brouillon" on public.orders;
drop policy if exists "orders: abandonner une commande non partie" on public.orders;
create policy "orders: abandonner une commande non partie" on public.orders
  for delete to authenticated
  using (user_id = auth.uid() and status in ('draft', 'file_ready', 'failed') and supplier_ref is null);

-- ── 3. Dossier des PDF (privé) ───────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('print-files', 'print-files', false)
on conflict (id) do nothing;

drop policy if exists "print-files: déposer dans son dossier" on storage.objects;
create policy "print-files: déposer dans son dossier" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'print-files' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "print-files: remplacer dans son dossier" on storage.objects;
create policy "print-files: remplacer dans son dossier" on storage.objects
  for update to authenticated
  using (bucket_id = 'print-files' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "print-files: lire son dossier" on storage.objects;
create policy "print-files: lire son dossier" on storage.objects
  for select to authenticated
  using (bucket_id = 'print-files' and (storage.foldername(name))[1] = auth.uid()::text);

-- Supprimer le PDF déposé quand on abandonne la commande (dans son propre dossier seulement).
drop policy if exists "print-files: supprimer dans son dossier" on storage.objects;
create policy "print-files: supprimer dans son dossier" on storage.objects
  for delete to authenticated
  using (bucket_id = 'print-files' and (storage.foldername(name))[1] = auth.uid()::text);
