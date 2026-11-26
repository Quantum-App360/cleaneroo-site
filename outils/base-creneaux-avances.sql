-- Créneaux avancés (26/11/2026, accord de Michael) : vraies disponibilités des Cleaneurs, plage horaire, créneaux « tournée ».
-- Aucune donnée existante modifiée ; les prix ne changent pas (le prix reste celui du début de la plage, details.creneauPrix).

-- 1. Plage horaire : le Cleaneur arrive entre creneau et plage_fin ; il fixe son heure en prenant la mission (ou en proposant).
alter table public.demandes add column if not exists plage_fin timestamptz;

-- 2. Nombre de Cleaneurs libres par demi-heure, pour un jour et une adresse (jamais d'identité).
--    Cleaneur compté : dossier validé, non banni, indépendant ou société, prestation proposée, adresse dans sa zone,
--    heure ouverte dans « Mes créneaux disponibles » (grille vide = non renseignée = compté), pas de mission ni de période fermée qui chevauche.
--    zone : nombre de Cleaneurs de la zone (0 = personne encore : l'écran ne grise rien).
create or replace function public.creneaux_disponibles(p_rubrique text, p_lat double precision, p_lon double precision, p_jour date, p_duree_min integer default 60)
returns table(heure numeric, cleaneurs integer, zone integer)
language sql stable security definer set search_path = '' as $$
  with c as (
    select p.id, p.disponibilites
      from public.profils p
     where (p.role = 'cleaneur' or 'cleaneur' = any (p.statuts)) and p.dossier = 'VALIDE' and p.banni_le is null and p.employeur_id is null
       and p_rubrique = any (coalesce(p.prestations, '{}'))
       and p_lat is not null and p.zone_lat is not null
       and public.km_entre(p.zone_lat, p.zone_lon, p_lat, p_lon) <= coalesce(p.zone_km, 20)),
  h as (select (6 + i * 0.5)::numeric as heure from generate_series(0, 31) i),
  t as (select h.heure, ((p_jour::timestamp + make_interval(mins => (h.heure * 60)::int)) at time zone 'Europe/Paris') as debut from h)
  select t.heure,
    (select count(*)::int from c
      where (c.disponibilites is null or c.disponibilites = '{}'::jsonb
             or coalesce(c.disponibilites -> extract(isodow from p_jour)::int::text, '[]'::jsonb) @> to_jsonb(floor(t.heure)::int))
        and not exists (select 1 from public.demandes x where x.cleaneur_id = c.id and x.statut in ('CONFIRMEE', 'EN_ROUTE', 'SUR_PLACE', 'EN_COURS')
              and x.creneau < t.debut + make_interval(mins => greatest(30, coalesce(p_duree_min, 60)) + 30)
              and x.creneau + make_interval(mins => coalesce(x.duree_min, 60) + 30) > t.debut)
        and not exists (select 1 from public.periodes_fermees f where f.cleaneur_id = c.id and f.debut < t.debut + make_interval(mins => coalesce(p_duree_min, 60)) and f.fin > t.debut)),
    (select count(*)::int from c)
  from t order by t.heure;
$$;
grant execute on function public.creneaux_disponibles(text, double precision, double precision, date, integer) to anon, authenticated;

-- 3. Créneaux « tournée » : heures de fin des missions déjà confirmées à moins de 5 km ce jour-là (heures seules, aucun détail).
create or replace function public.creneaux_tournee(p_lat double precision, p_lon double precision, p_jour date)
returns table(fin timestamptz)
language sql stable security definer set search_path = '' as $$
  select distinct x.creneau + make_interval(mins => coalesce(x.duree_min, 60))
    from public.demandes x
   where p_lat is not null and x.lat is not null and x.cleaneur_id is not null
     and x.statut in ('CONFIRMEE', 'EN_ROUTE', 'SUR_PLACE', 'EN_COURS')
     and (x.creneau at time zone 'Europe/Paris')::date = p_jour
     and public.km_entre(x.lat, x.lon, p_lat, p_lon) <= 5;
$$;
grant execute on function public.creneaux_tournee(double precision, double precision, date) to anon, authenticated;

-- 4. Plages des missions visibles par le Cleaneur connecté (référence, fin de plage).
create or replace function public.plages_missions()
returns table(reference text, plage_fin timestamptz)
language sql stable security definer set search_path = '' as $$
  select d.reference, d.plage_fin from public.demandes d
   where public.cleaneur_actif() and d.plage_fin is not null and d.statut = 'PUBLIEE' and d.cleaneur_id is null and public.mission_visible(d);
$$;
grant execute on function public.plages_missions() to authenticated;

-- 5. Prise de mission : le Cleaneur fixe son heure d'arrivée dans la plage ; le client est prévenu.
do $$
declare f text;
begin
  f := pg_get_functiondef('public.prendre_mission(text)'::regprocedure);
  f := replace(f, 'public.prendre_mission(p_reference text)', 'public.prendre_mission(p_reference text, p_heure timestamp with time zone DEFAULT NULL::timestamp with time zone)');
  f := replace(f, 'declare n integer;', 'declare n integer; pl public.demandes;');
  f := replace(f, '  update public.demandes set cleaneur_id = auth.uid(), statut = ''CONFIRMEE''
   where reference = p_reference and statut = ''PUBLIEE'' and cleaneur_id is null;',
'  -- Plage horaire (26/11/2026) : heure d''arrivée choisie dans la plage, sinon le début de la plage.
  select * into pl from public.demandes where reference = p_reference;
  if p_heure is not null and (pl.plage_fin is null or p_heure < pl.creneau or p_heure > pl.plage_fin) then return ''heure''; end if;
  update public.demandes set cleaneur_id = auth.uid(), statut = ''CONFIRMEE'', creneau = coalesce(p_heure, creneau)
   where reference = p_reference and statut = ''PUBLIEE'' and cleaneur_id is null;');
  f := replace(f, '  if n = 1 then
    update public.profils p set pro_offert_jusqu',
'  if n = 1 and pl.plage_fin is not null then
    perform public.notifier(pl.client_id, ''client'', ''confirmee'', ''important'', ''Heure d''''arrivée fixée'',
      ''Votre Cleaneur arrivera le '' || to_char(coalesce(p_heure, pl.creneau) at time zone ''Europe/Paris'', ''DD/MM à HH24"h"MI'') || ''.'', p_reference);
  end if;
  if n = 1 then
    update public.profils p set pro_offert_jusqu');
  if position('p_heure' in f) = 0 or position('Heure d''''arrivée' in f) = 0 or position('pl.plage_fin is null' in f) = 0 then raise exception 'prendre_mission : passage introuvable'; end if;
  drop function public.prendre_mission(text);
  execute f;
end $$;
revoke all on function public.prendre_mission(text, timestamptz) from public, anon;
grant execute on function public.prendre_mission(text, timestamptz) to authenticated, service_role;

-- 6. Proposition avec une autre heure : dans la plage si la demande en a une.
do $$
declare f text;
begin
  f := pg_get_functiondef('public.proposer(text,integer,text,text,integer,timestamp with time zone,text,integer)'::regprocedure);
  if position('plage_fin' in f) = 0 then
    f := replace(f, '  if not public.equipe_pour(d, auth.uid()) then return ''equipement''; end if;',
'  if not public.equipe_pour(d, auth.uid()) then return ''equipement''; end if;
  if d.plage_fin is not null and p_autre_horaire is not null and (p_autre_horaire < d.creneau or p_autre_horaire > d.plage_fin) then return ''heure''; end if;');
    if position('plage_fin' in f) = 0 then raise exception 'proposer : passage introuvable'; end if;
    execute f;
  end if;
end $$;

-- 7. Garde-fou : une plage dure au plus 12 h et finit après son début ; elle disparaît dès qu'un Cleaneur reçoit la mission (heure fixée).
alter table public.demandes add constraint demandes_plage_check check (plage_fin is null or (creneau is not null and plage_fin > creneau and plage_fin <= creneau + interval '12 hours')) not valid;
alter table public.demandes validate constraint demandes_plage_check;
create or replace function public.marquer_mission_accompagnee() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.cleaneur_id is null then new.mission_accompagnee := false;
  elsif new.cleaneur_id is distinct from old.cleaneur_id then
    new.mission_accompagnee := exists (select 1 from public.profils p where p.id = new.cleaneur_id and p.mission_test <> 'REUSSIE' and p.employeur_id is null);
    new.plage_fin := null;   -- heure fixée dès qu'un Cleaneur reçoit la mission
  end if;
  return new;
end $$;

-- 8. Prix figé sur l'heure de début : details.creneauPrix posé à la création (site, appli, pilote automatique) s'il manque.
create or replace function public.figer_creneau_prix() returns trigger language plpgsql set search_path = '' as $$
begin
  if new.creneau is not null and coalesce(new.details->>'creneauPrix', '') = '' then
    new.details := coalesce(new.details, '{}'::jsonb) || jsonb_build_object('creneauPrix', to_char(new.creneau at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'));
  end if;
  return new;
end $$;
drop trigger if exists figer_creneau_prix on public.demandes;
create trigger figer_creneau_prix before insert on public.demandes for each row execute function public.figer_creneau_prix();
