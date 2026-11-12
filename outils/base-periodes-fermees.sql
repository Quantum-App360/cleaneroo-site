-- Périodes fermées du Cleaneur (12 novembre 2026, reprises de l'appli iPhone de Vincent) : vacances, obligation familiale,
-- rendez-vous médical, formation, autre. Pendant une période fermée, aucune mission n'est proposée (missions_disponibles)
-- ni ne peut être prise (prendre_mission → « fermee »). « Rouvrir cette période » = la supprimer.

create table if not exists public.periodes_fermees (
  id uuid primary key default gen_random_uuid(),
  cleaneur_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  debut timestamptz not null,
  fin timestamptz not null,
  motif text not null check (motif in ('VACANCES', 'FAMILLE', 'MEDICAL', 'FORMATION', 'AUTRE')),
  cree_le timestamptz not null default now(),
  check (fin > debut and fin <= debut + interval '1 year'));
alter table public.periodes_fermees enable row level security;
create index if not exists periodes_fermees_idx on public.periodes_fermees (cleaneur_id, fin);
drop policy if exists "période : lire les siennes ou admin" on public.periodes_fermees;
create policy "période : lire les siennes ou admin" on public.periodes_fermees for select to authenticated
  using (cleaneur_id = (select auth.uid()) or (select public.est_admin()));
drop policy if exists "période : ajouter les siennes" on public.periodes_fermees;
create policy "période : ajouter les siennes" on public.periodes_fermees for insert to authenticated
  with check (cleaneur_id = (select auth.uid()));
drop policy if exists "période : rouvrir les siennes" on public.periodes_fermees;
create policy "période : rouvrir les siennes" on public.periodes_fermees for delete to authenticated
  using (cleaneur_id = (select auth.uid()));
grant select, insert, delete on public.periodes_fermees to authenticated;

-- La demande tombe-t-elle dans une période fermée du Cleaneur connecté ? (fin de mission comprise)
create or replace function public.periode_fermee(d public.demandes) returns boolean language sql stable security definer set search_path to '' as $$
  select d.creneau is not null and exists (select 1 from public.periodes_fermees p where p.cleaneur_id = auth.uid()
    and p.debut < d.creneau + make_interval(mins => coalesce(d.duree_min, 0)) and p.fin > d.creneau);
$$;
revoke execute on function public.periode_fermee(public.demandes) from anon, public, authenticated;

create or replace function public.missions_disponibles()
 returns table(reference text, rubrique_id text, creneau timestamptz, flexible boolean, duree_min integer, nombre_cleaneurs smallint, estimation_c integer, sur_devis boolean, code_postal text, ville text, cree_le timestamptz, urgence boolean, prime_urgence_c integer)
 language sql stable security definer set search_path to '' as $$
  select d.reference, d.rubrique_id, d.creneau, d.flexible, d.duree_min, d.nombre_cleaneurs, d.estimation_c, d.sur_devis, d.code_postal, d.ville, d.cree_le,
         d.urgence, d.prime_urgence_c
  from public.demandes d
  where public.cleaneur_actif() and d.statut = 'PUBLIEE' and d.cleaneur_id is null
    and (public.est_admin() or d.rubrique_id = any (coalesce((select p.prestations from public.profils p where p.id = auth.uid()), '{}')))
    and public.mission_visible(d) and public.qualifie(d) and not public.periode_fermee(d)
  order by d.urgence desc, d.creneau nulls last, d.cree_le
  limit 100;
$$;

create or replace function public.prendre_mission(p_reference text) returns text language plpgsql security definer set search_path to '' as $$
declare n integer;
begin
  if auth.uid() is null then return 'connexion'; end if;
  if not public.cleaneur_actif() then return 'dossier'; end if;
  if now() < timestamptz '2027-01-01 00:00 Europe/Paris' and not public.est_admin() then return 'ouverture'; end if;
  if not exists (select 1 from public.demandes d where d.reference = p_reference and public.mission_visible(d)) then return 'formule'; end if;
  if not exists (select 1 from public.demandes d where d.reference = p_reference and public.qualifie(d)) then return 'qualification'; end if;
  if exists (select 1 from public.demandes d where d.reference = p_reference and public.periode_fermee(d)) then return 'fermee'; end if;
  update public.demandes set cleaneur_id = auth.uid(), statut = 'CONFIRMEE'
   where reference = p_reference and statut = 'PUBLIEE' and cleaneur_id is null;
  get diagnostics n = row_count;
  if n = 1 then
    update public.profils p set pro_offert_jusqu = now() + interval '3 months'
     where p.id = auth.uid() and p.pro_offert_jusqu is null and public.offre_lancement(p);
  end if;
  return case when n = 1 then 'ok' else 'deja_prise' end;
end $$;
