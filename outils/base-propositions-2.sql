-- Propositions des Cleaneurs, compléments (12 novembre 2026, comme l'appli de Vincent) :
-- 1. Frais de déplacement proposés par le Cleaneur (barème indicatif : inclus jusqu'à 15 km, 8 € jusqu'à 30 km, 15 € jusqu'à
--    50 km, au-delà 0,30 €/km aller-retour, 60 € au plus — REGLES.FRAIS_DEPLACEMENT_*) ; jamais ajoutés sans l'accord du client.
-- 2. Pas deux propositions en attente sur des créneaux qui se chevauchent ; pas de proposition qui chevauche une mission
--    confirmée (30 min de déplacement autour).
-- 3. Enchaînement : le Cleaneur sort d'une autre mission juste avant (≤ 60 min) ; le client accepte le risque d'un léger retard.
-- 4. Propositions expirées automatiquement (toutes les 5 min), le Cleaneur est prévenu ; la recherche continue.

alter table public.propositions add column if not exists frais_c integer not null default 0;
alter table public.propositions drop constraint if exists propositions_frais_c_check;
alter table public.propositions add constraint propositions_frais_c_check check (frais_c between 0 and 6000);
alter table public.propositions add column if not exists enchainement boolean not null default false;

drop function if exists public.proposer(text, integer, text, text, integer, timestamptz, text);
create or replace function public.proposer(p_reference text, p_prix_c integer, p_raison text default '', p_note text default '',
  p_temps_sup_min integer default 0, p_autre_horaire timestamptz default null, p_exclusions text default '', p_frais_c integer default 0) returns text
language plpgsql security definer set search_path to '' as $$
declare d public.demandes; base integer; n integer; debut timestamptz; fin timestamptz; ench boolean;
begin
  if auth.uid() is null then return 'connexion'; end if;
  if not public.cleaneur_actif() then return 'dossier'; end if;
  if now() < timestamptz '2027-01-01 00:00 Europe/Paris' and not public.est_admin() then return 'ouverture'; end if;
  select * into d from public.demandes where reference = p_reference;
  if d.id is null or d.statut <> 'PUBLIEE' or d.cleaneur_id is not null then return 'indisponible'; end if;
  if not (public.mission_visible(d) and public.qualifie(d) and not public.periode_fermee(d)) then return 'indisponible'; end if;
  if not public.rc_pro_couvre(d) then return 'assurance'; end if;
  base := coalesce(d.estimation_initiale_c, d.estimation_c);
  if p_prix_c < round(base * 0.9) then return 'remise'; end if;
  if p_prix_c > round(base * 1.5) then return 'devis'; end if;
  if p_prix_c > base and (p_raison not in ('TEMPS', 'ETAT', 'ACCES', 'MATERIEL', 'AUTRE_HAUSSE') or char_length(trim(coalesce(p_note, ''))) < 20) then return 'justification'; end if;
  if p_prix_c < base and p_raison not in ('PROXIMITE', 'LANCEMENT', 'FIDELITE', 'AUTRE_REMISE') then return 'raison'; end if;
  if coalesce(p_frais_c, 0) not between 0 and 6000 then return 'frais'; end if;
  select count(*) into n from public.propositions where reference = p_reference and statut <> 'RETIREE' and cleaneur_id <> auth.uid();
  if n >= 5 then return 'complet'; end if;
  debut := coalesce(p_autre_horaire, d.creneau);
  if debut is not null then
    fin := debut + make_interval(mins => coalesce(d.duree_min, 0) + coalesce(p_temps_sup_min, 0));
    -- Mission confirmée qui chevauche (30 min de déplacement autour).
    if exists (select 1 from public.demandes x where x.cleaneur_id = auth.uid() and x.statut in ('CONFIRMEE', 'EN_ROUTE', 'SUR_PLACE', 'EN_COURS')
        and x.creneau is not null and x.creneau - interval '30 minutes' < fin and x.creneau + make_interval(mins => coalesce(x.duree_min, 0) + 30) > debut
        and not (x.creneau + make_interval(mins => coalesce(x.duree_min, 0)) <= debut and x.creneau + make_interval(mins => coalesce(x.duree_min, 0)) >= debut - interval '60 minutes'
                 and x.ville = d.ville)) then return 'planning'; end if;
    -- Autre proposition en attente sur un créneau qui chevauche.
    if exists (select 1 from public.propositions p join public.demandes y on y.reference = p.reference
        where p.cleaneur_id = auth.uid() and p.reference <> p_reference and p.statut = 'EN_ATTENTE' and p.expire_le > now()
          and coalesce(p.autre_horaire, y.creneau) < fin
          and coalesce(p.autre_horaire, y.creneau) + make_interval(mins => coalesce(y.duree_min, 0) + p.temps_sup_min) > debut) then return 'chevauchement'; end if;
    -- Enchaînement : une mission du Cleaneur, le même jour, finit au plus 60 min avant.
    ench := exists (select 1 from public.demandes x where x.cleaneur_id = auth.uid() and x.statut in ('CONFIRMEE', 'EN_ROUTE', 'SUR_PLACE', 'EN_COURS')
        and x.creneau is not null and x.creneau + make_interval(mins => coalesce(x.duree_min, 0)) between debut - interval '60 minutes' and debut);
  end if;
  insert into public.propositions (reference, cleaneur_id, prix_c, raison, note, temps_sup_min, autre_horaire, exclusions, expire_le, frais_c, enchainement)
  values (p_reference, auth.uid(), p_prix_c, case when p_prix_c = base then '' else coalesce(p_raison, '') end, left(trim(coalesce(p_note, '')), 500),
    coalesce(p_temps_sup_min, 0), p_autre_horaire, left(trim(coalesce(p_exclusions, '')), 300),
    now() + make_interval(mins => public.delai_reponse_min(debut)), coalesce(p_frais_c, 0), coalesce(ench, false))
  on conflict (reference, cleaneur_id) do update set prix_c = excluded.prix_c, raison = excluded.raison, note = excluded.note,
    temps_sup_min = excluded.temps_sup_min, autre_horaire = excluded.autre_horaire, exclusions = excluded.exclusions, frais_c = excluded.frais_c,
    enchainement = excluded.enchainement, statut = 'EN_ATTENTE', expire_le = excluded.expire_le, cree_le = now();
  perform public.notifier(d.client_id, 'client', 'mission', 'important', 'Nouvelle proposition',
    coalesce((select prenom from public.profils where id = auth.uid()), 'Un Cleaneur') || ' · ' || to_char((p_prix_c + coalesce(p_frais_c, 0)) / 100.0, 'FM999990D00') || ' €', p_reference);
  return 'ok';
end $$;
revoke execute on function public.proposer(text, integer, text, text, integer, timestamptz, text, integer) from anon, public;
grant execute on function public.proposer(text, integer, text, text, integer, timestamptz, text, integer) to authenticated;

drop function if exists public.propositions_de(text, uuid);
create or replace function public.propositions_de(p_reference text, p_jeton uuid default null) returns table(
  id uuid, prenom text, niveau integer, note numeric, nb_avis integer, prix_c integer, estimation_c integer, raison text, note_cleaneur text,
  temps_sup_min integer, autre_horaire timestamptz, exclusions text, expire_le timestamptz, frais_c integer, enchainement boolean)
language sql stable security definer set search_path to '' as $$
  select p.id, pr.prenom, coalesce((public.niveau_de(p.cleaneur_id)->>'niveau')::int, 0),
    (select round(avg(a.note)::numeric, 1) from public.avis a where a.cleaneur_id = p.cleaneur_id and a.note is not null and public.avis_revele(a)),
    (select count(*)::int from public.avis a where a.cleaneur_id = p.cleaneur_id and a.note is not null and public.avis_revele(a)),
    p.prix_c, coalesce(d.estimation_initiale_c, d.estimation_c), p.raison, p.note, p.temps_sup_min, p.autre_horaire, p.exclusions, p.expire_le, p.frais_c, p.enchainement
  from public.propositions p join public.demandes d on d.reference = p.reference left join public.profils pr on pr.id = p.cleaneur_id
  where p.reference = p_reference and p.statut = 'EN_ATTENTE' and p.expire_le > now() and d.statut = 'PUBLIEE'
    and ((p_jeton is not null and d.jeton = p_jeton) or (auth.uid() is not null and d.client_id = auth.uid()))
  order by p.prix_c + p.frais_c, p.cree_le;
$$;
grant execute on function public.propositions_de(text, uuid) to anon, authenticated;

drop function if exists public.accepter_proposition(uuid, uuid);
create or replace function public.accepter_proposition(p_id uuid, p_jeton uuid default null, p_accepte_risque boolean default false) returns text
language plpgsql security definer set search_path to '' as $$
declare p public.propositions; d public.demandes;
begin
  select * into p from public.propositions where id = p_id;
  if p.id is null then return 'introuvable'; end if;
  select * into d from public.demandes where reference = p.reference
    and ((p_jeton is not null and jeton = p_jeton) or (auth.uid() is not null and client_id = auth.uid()));
  if d.id is null then return 'introuvable'; end if;
  if d.statut <> 'PUBLIEE' or d.cleaneur_id is not null then return 'deja_prise'; end if;
  if p.statut <> 'EN_ATTENTE' or p.expire_le < now() then return 'expiree'; end if;
  if p.enchainement and not coalesce(p_accepte_risque, false) then return 'risque'; end if;
  update public.demandes set cleaneur_id = p.cleaneur_id, statut = 'CONFIRMEE',
    estimation_initiale_c = coalesce(estimation_initiale_c, estimation_c), estimation_c = p.prix_c + p.frais_c,
    creneau = coalesce(p.autre_horaire, creneau),
    duree_min = greatest(30, duree_min + p.temps_sup_min),
    etapes = etapes || jsonb_build_object('proposition', p.id) || case when p.frais_c > 0 then jsonb_build_object('frais_deplacement_c', p.frais_c) else '{}'::jsonb end
   where id = d.id;
  update public.propositions set statut = 'ACCEPTEE' where id = p.id;
  update public.propositions set statut = 'CLOTUREE' where reference = p.reference and id <> p.id and statut = 'EN_ATTENTE';
  update public.profils pr set pro_offert_jusqu = now() + interval '3 months'
   where pr.id = p.cleaneur_id and pr.pro_offert_jusqu is null and public.offre_lancement(pr);
  return 'ok';
end $$;
grant execute on function public.accepter_proposition(uuid, uuid, boolean) to anon, authenticated;

-- Expiration automatique des propositions (le Cleaneur est prévenu, la recherche continue).
create or replace function public.expirer_propositions() returns void language plpgsql security definer set search_path to '' as $$
declare p record;
begin
  for p in update public.propositions set statut = 'EXPIREE' where statut = 'EN_ATTENTE' and expire_le < now() returning cleaneur_id, reference loop
    perform public.notifier(p.cleaneur_id, 'cleaneur', 'info', 'standard', 'Proposition expirée', 'Le client n''a pas répondu à temps : vous êtes libéré de ce créneau.', p.reference);
  end loop;
end $$;
revoke execute on function public.expirer_propositions() from anon, public, authenticated;
select cron.schedule('propositions-expirees', '*/5 * * * *', 'select public.expirer_propositions()');
