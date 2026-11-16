-- supabase/sql/orders_posters.sql
-- Commandes de POSTERS : à COLLER dans Supabase → SQL Editor → Run, APRÈS orders_et_adresses.sql. Sûr à relancer.
--
-- Ce que ça change dans la table `orders` (déjà utilisée par les livres photo) :
--   · kind     : 'book' ou 'poster'
--   · product  : 'a4' | 'paysage' (livres) ou 'a4' | 'a3' | 'a2' | 'a1' (posters : le format de la FEUILLE, toujours portrait)
--   · pages    : seulement pour les livres (24 à 120, pair) ; vide pour un poster
--   · quantity : nombre d'exemplaires (1 à 10), 1 pour un livre
--   · spec     : jsonb = tout ce qu'il faut pour comprendre / refaire le fichier (format, taille en mm, résolution, photos, titre…)
--   · status   : nouveau statut 'received' = « Reçue par Pellicule » : commande enregistrée, fichier là, prix recalculé par le
--                serveur, MAIS PAS ENCORE TRANSMISE à imprimeur.fr (les posters ne partent pas chez l'imprimeur pour l'instant).
-- Le fichier du poster (JPEG) est rangé dans le dossier privé `print-files`, comme le PDF d'un livre : <compte>/<commande>.jpg

-- ── kind ──────────────────────────────────────────────────────────────────────
alter table public.orders drop constraint if exists orders_kind_check;
alter table public.orders add constraint orders_kind_check check (kind in ('book', 'poster'));

-- ── product ───────────────────────────────────────────────────────────────────
alter table public.orders drop constraint if exists orders_product_check;
alter table public.orders add constraint orders_product_check check (product in ('a4', 'paysage', 'a3', 'a2', 'a1'));

-- ── pages : seulement pour un livre ───────────────────────────────────────────
alter table public.orders alter column pages drop not null;
alter table public.orders drop constraint if exists orders_pages_check;
alter table public.orders add constraint orders_pages_check
  check (pages is null or (pages between 24 and 120 and pages % 2 = 0));
alter table public.orders drop constraint if exists orders_pages_for_books;
alter table public.orders add constraint orders_pages_for_books check (kind <> 'book' or pages is not null);

-- ── quantité + détails du fichier ─────────────────────────────────────────────
alter table public.orders add column if not exists quantity int not null default 1;
alter table public.orders drop constraint if exists orders_quantity_check;
alter table public.orders add constraint orders_quantity_check check (quantity between 1 and 10);
alter table public.orders add column if not exists spec jsonb;

-- ── status : + 'received' ─────────────────────────────────────────────────────
alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check
  check (status in ('draft', 'file_ready', 'failed', 'received', 'transmitted', 'printed', 'mailed', 'delivered', 'cancelled'));

-- Les règles de sécurité (RLS) ne changent pas : l'app crée en « draft », prépare « file_ready » ; seul le serveur pose
-- le prix, « received » et la suite. Pour voir une commande de poster : Table Editor → orders (kind = poster), colonnes
-- spec (format, résolution), address, file_path ; le fichier lui-même : Storage → print-files → <compte>/<commande>.jpg
