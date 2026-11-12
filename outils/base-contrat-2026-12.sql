-- Contrat de prestataire version 2026-12 (12 novembre 2026) — appliqué (migrations « contrat_2026_12 » et « signer_contrat_version_actuelle »).
-- contrat_version_actuelle() = '2026-12' (à changer avec CONTRAT_VERSION de dossier.js et Dossier.kt).
-- ce_qui_me_manque() et soumettre_dossier() : contrat signé = signé ET version en vigueur.
-- signer_contrat() : refuse une autre version ('version').
-- remettre_en_urgence() : désactivation au-delà de 2 avertissements sur 12 mois (et non plus depuis toujours).
create or replace function public.contrat_version_actuelle() returns text language sql immutable set search_path to '' as $$ select '2026-12'::text $$;
