-- À coller UNE fois dans Supabase → SQL Editor (sans risque, relançable).
-- Permet à l'app d'abandonner une commande de livre jamais transmise à l'imprimeur
-- (« Non envoyée », « À transmettre », « À reprendre ») et de supprimer le PDF déjà déposé.
-- Une commande transmise (supplier_ref posé) reste impossible à supprimer depuis l'app.

drop policy if exists "orders: supprimer un brouillon" on public.orders;
drop policy if exists "orders: abandonner une commande non partie" on public.orders;
create policy "orders: abandonner une commande non partie" on public.orders
  for delete to authenticated
  using (user_id = auth.uid() and status in ('draft', 'file_ready', 'failed') and supplier_ref is null);

drop policy if exists "print-files: supprimer dans son dossier" on storage.objects;
create policy "print-files: supprimer dans son dossier" on storage.objects
  for delete to authenticated
  using (bucket_id = 'print-files' and (storage.foldername(name))[1] = auth.uid()::text);
