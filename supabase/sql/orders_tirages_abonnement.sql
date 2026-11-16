-- supabase/sql/orders_tirages_abonnement.sql
-- TIRAGES SIMPLES + ADRESSES DES ABONNEMENTS : à COLLER dans Supabase → SQL Editor → Run, APRÈS orders_et_adresses.sql
-- et orders_posters.sql. Sûr à relancer.
--
-- 1. `orders` accepte les commandes de tirages simples :
--      kind = 'print' · product = '10x15' ou '10x10' · quantity = nombre de tirages (20 à 1 000)
--      file_path = le DOSSIER des photos (<compte>/<commande>), une photo par fichier (1.jpg, 2.jpg…) dans le dossier privé `print-files`
--      spec = format, taille en mm, recadrage, et pour chaque photo { path, w, h, shape }
--    (quantity : 1 pour un livre, 1 à 10 pour un poster, 20 à 1 000 pour des tirages)
-- 2. Les abonnements Coups de cœur gardent maintenant l'adresse du CARNET D'ADRESSES du compte, sous forme structurée
--    (nom, rue, code postal, ville, téléphone) : colonne `address_data` dans `subscriptions` et `print_orders`.
--    La colonne texte `address` reste (affichage, anciens abonnements).

-- ── orders : kind, product, quantity ────────────────────────────────────────
alter table public.orders drop constraint if exists orders_kind_check;
alter table public.orders add constraint orders_kind_check check (kind in ('book', 'poster', 'print'));

alter table public.orders drop constraint if exists orders_product_check;
alter table public.orders add constraint orders_product_check
  check (product in ('a4', 'paysage', 'a3', 'a2', 'a1', '10x15', '10x10'));

alter table public.orders drop constraint if exists orders_quantity_check;
alter table public.orders add constraint orders_quantity_check check (
  (kind = 'book'   and quantity = 1) or
  (kind = 'poster' and quantity between 1 and 10) or
  (kind = 'print'  and quantity between 20 and 1000)
);

-- ── Adresse structurée des abonnements ──────────────────────────────────────
alter table public.subscriptions add column if not exists address_data jsonb;
alter table public.print_orders  add column if not exists address_data jsonb;
