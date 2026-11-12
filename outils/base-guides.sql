-- Guide d'accès en photos (12 novembre 2026, comme l'appli de Vincent) — appliqué (migration « guides_acces »).
-- Étapes (titre, note, photo) dans logements.guide (via enregistrerBien), copiées dans demandes.details.guide à la réservation.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('guides', 'guides', false, 5242880, array['image/jpeg','image/png','image/webp']) on conflict (id) do nothing;
-- Dépôt et suppression : dossier = compte du client ; lecture : le client, l'admin, ou le Cleaneur d'une demande confirmée
-- (CONFIRMEE … A_VALIDER) de ce client.
