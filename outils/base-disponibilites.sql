-- Créneaux disponibles du Cleaneur (12 novembre 2026, repris de l'appli de Vincent) — appliqué (migration « disponibilites_cleaneur ») :
-- profils.disponibilites jsonb {"1": [8, 9, …], …, "7": […]} (1 = lundi), modifiable par le Cleaneur (grant update).
-- Utilisé par le score de recommandation des missions (scoreMission dans regles.js et Regles.kt).
alter table public.profils add column if not exists disponibilites jsonb;
grant update (disponibilites) on public.profils to authenticated;
