-- Formules des Cleaneurs (7 novembre 2026, modèle économique « Cleaneroo_Modele_economique.pdf », décisions de l'utilisateur) :
--   Gratuit : 0 €/mois, commission 20 %, missions des particuliers seulement, visibles 30 min après leur publication ;
--   Pro : 19,99 €/mois, commission 12 %, toutes les missions (particuliers, conciergeries, entreprises), 30 min d'avance, badge Pro.
--   Les 500 premiers dossiers validés ont la formule Pro offerte pendant 12 mois (pro_offert_jusqu), puis Pro payant ou Gratuit.
--   Le prélèvement de l'abonnement se branchera avec Stripe ; d'ici là, le choix est enregistré.

alter table public.profils add column if not exists formule_cleaneur text not null default 'gratuit';
alter table public.profils add column if not exists pro_offert_jusqu timestamptz;
alter table public.profils drop constraint if exists profils_formule_cleaneur_check;
alter table public.profils add constraint profils_formule_cleaneur_check check (formule_cleaneur in ('gratuit', 'pro'));

-- Formule effective : Pro si offerte (et pas expirée) ou choisie ; l'administration a tout.
create or replace function public.formule_effective(p_id uuid) returns text
language sql stable security definer set search_path = '' as $$
  select case when p.role = 'admin' or p.formule_cleaneur = 'pro' or coalesce(p.pro_offert_jusqu > now(), false) then 'pro' else 'gratuit' end
  from public.profils p where p.id = p_id;
$$;

-- Validation d'un dossier : Pro offert 12 mois tant que les 500 places ne sont pas toutes prises.
create or replace function public.offrir_pro_a_la_validation() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.dossier = 'VALIDE' and coalesce(old.dossier, '') <> 'VALIDE' and new.role = 'cleaneur' and new.pro_offert_jusqu is null
     and (select count(*) from public.profils p where p.role = 'cleaneur' and p.pro_offert_jusqu is not null) < 500 then
    new.pro_offert_jusqu := now() + interval '12 months';
  end if;
  return new;
end $$;
drop trigger if exists profils_offrir_pro on public.profils;
create trigger profils_offrir_pro before update of dossier on public.profils for each row execute function public.offrir_pro_a_la_validation();

-- Le Cleaneur choisit sa formule (« gratuit » ou « pro »).
create or replace function public.choisir_formule(f text) returns text
language plpgsql security definer set search_path = '' as $$
begin
  if f not in ('gratuit', 'pro') then return 'invalide'; end if;
  update public.profils set formule_cleaneur = f where id = auth.uid() and 'cleaneur' = any (statuts);
  return case when found then 'ok' else 'interdit' end;
end $$;
revoke all on function public.choisir_formule(text) from public, anon;
grant execute on function public.choisir_formule(text) to authenticated;

-- Une mission est visible : Pro → toutes ; Gratuit → particuliers seulement, 30 min après leur publication.
create or replace function public.mission_visible(d public.demandes) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.est_admin() or public.formule_effective(auth.uid()) = 'pro'
    or (coalesce(d.espace, 'personnel') = 'personnel' and d.cree_le <= now() - interval '30 minutes');
$$;

create or replace function public.missions_disponibles()
returns table (reference text, rubrique_id text, creneau timestamptz, flexible boolean, duree_min integer, nombre_cleaneurs smallint, estimation_c integer,
  sur_devis boolean, code_postal text, ville text, cree_le timestamptz)
language sql stable security definer set search_path = '' as $$
  select d.reference, d.rubrique_id, d.creneau, d.flexible, d.duree_min, d.nombre_cleaneurs, d.estimation_c, d.sur_devis, d.code_postal, d.ville, d.cree_le
  from public.demandes d
  where public.cleaneur_actif() and d.statut = 'PUBLIEE' and d.cleaneur_id is null
    and (public.est_admin() or d.rubrique_id = any (coalesce((select p.prestations from public.profils p where p.id = auth.uid()), '{}')))
    and public.mission_visible(d)
  order by d.creneau nulls last, d.cree_le
  limit 100;
$$;

create or replace function public.prendre_mission(p_reference text) returns text
language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  if auth.uid() is null then return 'connexion'; end if;
  if not public.cleaneur_actif() then return 'dossier'; end if;
  if now() < timestamptz '2027-01-01 00:00 Europe/Paris' and not public.est_admin() then return 'ouverture'; end if;
  if not exists (select 1 from public.demandes d where d.reference = p_reference and public.mission_visible(d)) then return 'formule'; end if;
  update public.demandes set cleaneur_id = auth.uid(), statut = 'CONFIRMEE'
   where reference = p_reference and statut = 'PUBLIEE' and cleaneur_id is null;
  get diagnostics n = row_count;
  return case when n = 1 then 'ok' else 'deja_prise' end;
end $$;
