-- Cleaneroo AI, lot D (26/11/2026) : équipements des Cleaneurs. Une mission préparée par Cleaneroo AI peut exiger du matériel
-- (details.equipementsRequis, ex. ["injecteur_extracteur"], tiré de la base de connaissances). Elle n'est alors proposée, visible
-- et prenable que par les Cleaneurs qui ont coché ce matériel dans leur profil. Les autres réservations ne changent pas
-- (aucun équipement requis = aucune condition).

alter table public.profils add column if not exists equipements text[] not null default '{}';

create or replace function public.equipe_pour(d public.demandes, p_cleaneur uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select jsonb_typeof(d.details -> 'equipementsRequis') is distinct from 'array'
      or jsonb_array_length(d.details -> 'equipementsRequis') = 0
      or coalesce((select p.equipements from public.profils p where p.id = p_cleaneur), '{}')
         @> array(select jsonb_array_elements_text(d.details -> 'equipementsRequis'))
$$;
revoke all on function public.equipe_pour(public.demandes, uuid) from public;
grant execute on function public.equipe_pour(public.demandes, uuid) to authenticated;

-- Le Cleaneur enregistre son matériel (liste fermée : équipements actifs de la base de connaissances).
create or replace function public.maj_equipements(p_equipements text[]) returns text[]
language plpgsql security definer set search_path = '' as $$
declare liste text[];
begin
  if auth.uid() is null then raise exception 'connexion'; end if;
  select coalesce(array_agg(x order by x), '{}') into liste from (select distinct unnest(coalesce(p_equipements, '{}')) x) e
   where exists (select 1 from public.connaissances_ia k where k.type = 'equipement' and k.actif and k.donnees ->> 'id' = e.x);
  update public.profils set equipements = liste where id = auth.uid();
  return liste;
end $$;
revoke all on function public.maj_equipements(text[]) from public;
grant execute on function public.maj_equipements(text[]) to authenticated;

-- Missions disponibles : seulement celles dont le Cleaneur a le matériel.
create or replace function public.missions_disponibles()
 returns table(reference text, rubrique_id text, creneau timestamptz, flexible boolean, duree_min integer, nombre_cleaneurs smallint, estimation_c integer, sur_devis boolean, code_postal text, ville text, cree_le timestamptz, urgence boolean, prime_urgence_c integer, choix_cleaneur text)
 language sql stable security definer set search_path to '' as $function$
  select d.reference, d.rubrique_id, d.creneau, d.flexible, d.duree_min, d.nombre_cleaneurs, public.net_cleaneur_c(d, auth.uid()), d.sur_devis, d.code_postal, d.ville, d.cree_le,
         d.urgence, d.prime_urgence_c,
         case when d.urgence then 'directe' when public.favori_exclusif(d) then 'directe' when d.choix_cleaneur = 'favori' then 'candidatures' else coalesce(d.choix_cleaneur, 'candidatures') end
  from public.demandes d
  where public.cleaneur_actif() and d.statut = 'PUBLIEE' and d.cleaneur_id is null
    and (public.est_admin() or d.rubrique_id = any (coalesce((select p.prestations from public.profils p where p.id = auth.uid()), '{}')))
    and public.mission_visible(d) and public.qualifie(d) and not public.periode_fermee(d) and public.rc_pro_couvre(d)
    and (public.est_admin() or public.equipe_pour(d, auth.uid()))
  order by public.favori_exclusif(d) desc, d.urgence desc, d.creneau nulls last, d.cree_le
  limit 100;
$function$;

-- Missions vues mais impossibles : la raison « equipement » s'ajoute (le Cleaneur sait quel matériel cocher).

create or replace function public.missions_incompatibles()
 returns table(reference text, rubrique_id text, creneau timestamptz, ville text, raison text)
 language sql stable security definer set search_path to '' as $function$
  select d.reference, d.rubrique_id, d.creneau, d.ville,
    case when not public.qualifie(d) then 'qualification' when public.periode_fermee(d) then 'fermee'
         when not public.rc_pro_couvre(d) then 'assurance' else 'equipement' end
  from public.demandes d
  where public.cleaneur_actif() and not public.est_admin() and d.statut = 'PUBLIEE' and d.cleaneur_id is null
    and d.rubrique_id = any (coalesce((select p.prestations from public.profils p where p.id = auth.uid()), '{}'))
    and public.mission_visible(d)
    and (not public.qualifie(d) or public.periode_fermee(d) or not public.rc_pro_couvre(d) or not public.equipe_pour(d, auth.uid()))
  order by d.creneau nulls last limit 20;
$function$;


-- Prendre une mission ou proposer un prix : même contrôle, réponse « equipement ».
do $$
declare def text;
begin
  def := pg_get_functiondef('public.prendre_mission(text)'::regprocedure);
  if position('equipe_pour' in def) = 0 then
    def := replace(def, $r$  if not exists (select 1 from public.demandes d where d.reference = p_reference and public.rc_pro_couvre(d)) then return 'assurance'; end if;$r$,
      $r$  if not exists (select 1 from public.demandes d where d.reference = p_reference and public.rc_pro_couvre(d)) then return 'assurance'; end if;
  if not exists (select 1 from public.demandes d where d.reference = p_reference and public.equipe_pour(d, auth.uid())) then return 'equipement'; end if;$r$);
    if position('equipe_pour' in def) = 0 then raise exception 'prendre_mission : ligne de contrôle introuvable'; end if;
    execute def;
  end if;
  def := pg_get_functiondef('public.proposer(text, integer, text, text, integer, timestamptz, text, integer)'::regprocedure);
  if position('equipe_pour' in def) = 0 then
    def := replace(def, $r$  if not public.rc_pro_couvre(d) then return 'assurance'; end if;$r$,
      $r$  if not public.rc_pro_couvre(d) then return 'assurance'; end if;
  if not public.equipe_pour(d, auth.uid()) then return 'equipement'; end if;$r$);
    if position('equipe_pour' in def) = 0 then raise exception 'proposer : ligne de contrôle introuvable'; end if;
    execute def;
  end if;
  -- Alertes « Nouvelle mission pour vous » : seulement les Cleaneurs équipés.
  def := pg_get_functiondef('public.cibler_cleaneurs(public.demandes)'::regprocedure);
  if position('equipe_pour' in def) = 0 then
    def := replace(def, $r$      and d.rubrique_id = any (coalesce(p.prestations, '{}'))$r$,
      $r$      and d.rubrique_id = any (coalesce(p.prestations, '{}'))
      and public.equipe_pour(d, p.id)$r$);
    if position('equipe_pour' in def) = 0 then raise exception 'cibler_cleaneurs : ligne introuvable'; end if;
    execute def;
  end if;
end $$;
