-- supabase/sql/compte_et_progression.sql
-- COPIE DE SECOURS (reconstituée le 9 nov. d'après les notes du projet) : la sauvegarde de la progression et le bouton
-- « Supprimer mon compte ». Ces deux éléments ont été créés le 6 nov. directement dans Supabase, sans fichier gardé.
-- ⚠️ À lancer SEULEMENT si tu les as perdus (table `progress` ou fonction `delete_my_account` absentes).
--    Si tout marche déjà, ne touche à rien. Sûr à relancer (« if not exists » / « create or replace »).

-- ── Table `progress` : la progression de chaque compte (1 ligne par compte) ─────────────────────────────────────
create table if not exists public.progress (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.progress enable row level security;

drop policy if exists "progress: voir la sienne" on public.progress;
create policy "progress: voir la sienne" on public.progress
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "progress: créer la sienne" on public.progress;
create policy "progress: créer la sienne" on public.progress
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "progress: modifier la sienne" on public.progress;
create policy "progress: modifier la sienne" on public.progress
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ── Fonction `delete_my_account()` : supprime le compte de la personne connectée ────────────────────────────────
-- (appelée par le bouton « Supprimer mon compte » ; les lignes liées — progress, subscriptions, print_orders — partent
--  avec le compte grâce à « on delete cascade ». Les PHOTOS du dossier print-photos, elles, ne partent pas : à supprimer
--  à la main dans Storage.)
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if auth.uid() is null then
    raise exception 'Non connecté';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
