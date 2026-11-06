-- Base Supabase « cleaneroo » (Paris) : compteur des places de l'offre de lancement Cleaneurs (500 premiers validés).
-- À appliquer une fois, avec l'accord de l'utilisateur. Sans effet sur les inscriptions existantes.
-- 1. Date de validation du dossier d'un Cleaneur (remplie par l'administration dans gestion.html).
alter table public.inscriptions add column if not exists valide_le timestamptz;
-- 2. Places restantes, lisibles par tous (site et appli) sans exposer aucune donnée personnelle.
create or replace function public.places_offre_restantes()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select greatest(0, 500 - (select count(*) from public.inscriptions where type = 'cleaneur' and valide_le is not null))::integer;
$$;
revoke all on function public.places_offre_restantes() from public;
grant execute on function public.places_offre_restantes() to anon, authenticated;
