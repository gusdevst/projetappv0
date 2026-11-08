-- supabase/sql/subscriptions.sql
-- Abonnements « Coups de cœur » côté serveur : à COLLER dans Supabase → SQL Editor → Run.
-- Sûr à relancer. L'app y écrit à chaque abonnement, pause, reprise, résiliation, changement de dates ou d'adresse.
--
-- Ce que ça te donne :
--   • Table Editor → subscriptions : TOUS tes abonnés (actifs / en pause / résiliés), leur produit, leur adresse, leurs dates
--   • un nouveau téléphone retrouve ses abonnements (et l'historique de ses envois, via print_orders) après connexion
-- La sécurité (RLS) : chaque compte ne voit et ne modifie que ses propres lignes.

create table if not exists public.subscriptions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  sub_id        text not null,                                   -- id de l'abonnement sur le téléphone
  kind          text not null check (kind in ('self', 'gift')),  -- pour moi / pour un proche
  product       text not null default 'prints' check (product in ('prints', 'magnets')),
  count         int  not null check (count > 0),                 -- tirages ou magnets par mois
  name          text,                                            -- prénom du proche
  recipient     text,                                            -- nom sur l'enveloppe
  address       text not null,                                   -- adresse (2e ligne = complément)
  message       text,                                            -- petit mot
  validate_each boolean not null default true,                   -- « Je valide chaque envoi »
  selection_day int  not null default 1  check (selection_day between 1 and 28),
  send_day      int  not null default 25 check (send_day between 1 and 28),
  status        text not null default 'active' check (status in ('active', 'paused', 'cancelled')),
  created_at    timestamptz not null default now(),              -- date d'abonnement (celle de l'app)
  updated_at    timestamptz not null default now(),
  unique (user_id, sub_id)
);

alter table public.subscriptions enable row level security;

drop policy if exists "subscriptions: voir les siens" on public.subscriptions;
create policy "subscriptions: voir les siens" on public.subscriptions
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "subscriptions: créer le sien" on public.subscriptions;
create policy "subscriptions: créer le sien" on public.subscriptions
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "subscriptions: modifier le sien" on public.subscriptions;
create policy "subscriptions: modifier le sien" on public.subscriptions
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Pas de suppression côté app : « résilier » passe simplement status à 'cancelled' (on garde l'historique).
