-- Carte client « Cleaneroo près de chez vous » (#/carte, prompt 4, lot 2, 25 novembre 2026).
-- Secteurs couverts par des Cleaneurs validés, pour une prestation donnée (ou toutes si p_rubrique est vide).
-- Protection de la vie privée : le centre de chaque secteur est arrondi à une grille de 0,05° (environ 5,5 km nord-sud, 4 km est-ouest),
-- et plusieurs Cleaneurs d'une même case sont regroupés. Jamais d'adresse, d'identité ni de position exacte.
-- Mêmes critères que secteur_couvert (dossier VALIDE, non banni, rôle ou statut Cleaneur, zone renseignée, rayon plafonné à 50 km).
-- Lecture seule ; ouverte aux visiteurs (anon), comme secteur_couvert.

create or replace function public.secteurs_publics(p_rubrique text default null)
returns table(lat double precision, lon double precision, rayon_km integer, cleaneurs integer)
language sql
stable
security definer
set search_path to ''
as $$
  select (round(p.zone_lat::numeric * 20) / 20)::double precision,
         (round(p.zone_lon::numeric * 20) / 20)::double precision,
         max(least(coalesce(p.zone_km, 20), 50))::int,
         count(*)::int
  from public.profils p
  where p.dossier = 'VALIDE' and p.banni_le is null
    and (p.role = 'cleaneur' or 'cleaneur' = any (p.statuts))
    and p.zone_lat is not null and p.zone_lon is not null
    and (coalesce(p_rubrique, '') = '' or p_rubrique = any (p.prestations))
  group by 1, 2
  order by 1, 2;
$$;

revoke all on function public.secteurs_publics(text) from public;
grant execute on function public.secteurs_publics(text) to anon, authenticated;
