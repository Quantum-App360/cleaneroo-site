-- Base Supabase « cleaneroo » (Paris) : compteur des places de l'offre de lancement Cleaneurs (500 premiers validés).
-- Appliqué le 6 novembre 2026 avec l'accord de l'utilisateur. Sans effet sur les inscriptions existantes.
-- 1. Date de validation du dossier d'un Cleaneur (remplie par l'administration dans gestion.html).
alter table public.inscriptions add column if not exists valide_le timestamptz;
-- Une inscription publique ne peut jamais arriver déjà validée.
drop policy if exists "inscription : s'inscrire" on public.inscriptions;
create policy "inscription : s'inscrire" on public.inscriptions for insert to anon, authenticated
  with check (consentement and valide_le is null);
-- 2. Places restantes, lisibles par tous (site et appli) sans exposer aucune donnée personnelle.
create or replace function public.places_offre_restantes()
returns integer language sql stable security definer set search_path = public as $$
  select greatest(0, 500 - (select count(*) from public.inscriptions where type = 'cleaneur' and valide_le is not null))::integer;
$$;
revoke all on function public.places_offre_restantes() from public;
grant execute on function public.places_offre_restantes() to anon, authenticated;
-- 3. Valider (ou annuler la validation) d'un dossier Cleaneur : administration seulement.
create or replace function public.valider_dossier_cleaneur(inscription uuid, valide boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.est_admin() then raise exception 'réservé à l''administration'; end if;
  update public.inscriptions set valide_le = case when valide then coalesce(valide_le, now()) else null end
    where id = inscription and type = 'cleaneur';
end;
$$;
revoke all on function public.valider_dossier_cleaneur(uuid, boolean) from public;
grant execute on function public.valider_dossier_cleaneur(uuid, boolean) to authenticated;
