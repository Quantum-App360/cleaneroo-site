-- Secteur d'activité des comptes Entreprise (18 novembre 2026), appliqué : seules les prestations utiles au métier sont proposées.
alter table public.profils add column if not exists secteur text;
-- La fonction nouveau_profil() enregistre le secteur choisi à l'inscription (valeurs : bureaux, medical, commerce, restaurant, garage,
-- funeraire, syndic, nautisme, loueur, evenementiel, btp, industrie, autre).
