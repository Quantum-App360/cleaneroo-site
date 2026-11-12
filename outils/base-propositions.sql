-- Propositions des Cleaneurs (12 novembre 2026, reprises de l'appli iPhone de Vincent).
-- Demande en mode « candidatures » (choix_cleaneur) : chaque Cleaneur propose un prix (et, s'il le veut, un autre horaire) ;
-- le client choisit. Réservation directe : le premier qui se positionne au prix estimé obtient la mission (prendre_mission).
-- Règles (REGLES.PROPOSITION_* dans regles.js et Regles.kt) :
--   remise ≤ 10 % de l'estimation (raison : proximité, lancement, fidélité, autre) ; hausse ≤ 50 %, toujours justifiée
--   (raison + note d'au moins 20 caractères visible du client) ; 5 propositions au plus par demande ;
--   le client répond sous 2 h (30 min si l'intervention a lieu dans moins de 24 h, jamais après 1 h avant l'arrivée, 10 min au moins).
-- La commission Cleaneroo reste calculée sur l'estimation de la réservation (estimation_initiale_c), quel que soit le prix accepté.

alter table public.demandes add column if not exists estimation_initiale_c integer;

create table if not exists public.propositions (
  id uuid primary key default gen_random_uuid(),
  reference text not null references public.demandes(reference) on delete cascade,
  cleaneur_id uuid not null references auth.users(id) on delete cascade,
  prix_c integer not null check (prix_c > 0),
  raison text not null default '' check (raison in ('', 'PROXIMITE', 'LANCEMENT', 'FIDELITE', 'AUTRE_REMISE', 'TEMPS', 'ETAT', 'ACCES', 'MATERIEL', 'AUTRE_HAUSSE')),
  note text not null default '' check (char_length(note) <= 500),
  temps_sup_min integer not null default 0 check (temps_sup_min between -120 and 240),
  autre_horaire timestamptz,
  exclusions text not null default '' check (char_length(exclusions) <= 300),
  statut text not null default 'EN_ATTENTE' check (statut in ('EN_ATTENTE', 'ACCEPTEE', 'REFUSEE', 'EXPIREE', 'RETIREE', 'CLOTUREE')),
  expire_le timestamptz not null,
  cree_le timestamptz not null default now(),
  unique (reference, cleaneur_id));
alter table public.propositions enable row level security;   -- lecture et écriture par les fonctions
revoke all on public.propositions from anon, authenticated;
create index if not exists propositions_ref_idx on public.propositions (reference, statut);

-- Délai de réponse du client (minutes) selon l'heure de l'intervention.
create or replace function public.delai_reponse_min(p_creneau timestamptz) returns integer language sql stable set search_path to '' as $$
  select case when p_creneau is null then 120
    else greatest(10, least(case when p_creneau - now() < interval '24 hours' then 30 else 120 end,
                            floor(extract(epoch from (p_creneau - interval '1 hour' - now())) / 60)::int)) end;
$$;

-- Le Cleaneur propose (ou met à jour sa proposition).
create or replace function public.proposer(p_reference text, p_prix_c integer, p_raison text default '', p_note text default '',
  p_temps_sup_min integer default 0, p_autre_horaire timestamptz default null, p_exclusions text default '') returns text
language plpgsql security definer set search_path to '' as $$
declare d public.demandes; base integer; n integer;
begin
  if auth.uid() is null then return 'connexion'; end if;
  if not public.cleaneur_actif() then return 'dossier'; end if;
  if now() < timestamptz '2027-01-01 00:00 Europe/Paris' and not public.est_admin() then return 'ouverture'; end if;
  select * into d from public.demandes where reference = p_reference;
  if d.id is null or d.statut <> 'PUBLIEE' or d.cleaneur_id is not null then return 'indisponible'; end if;
  if not (public.mission_visible(d) and public.qualifie(d) and not public.periode_fermee(d)) then return 'indisponible'; end if;
  base := coalesce(d.estimation_initiale_c, d.estimation_c);
  if p_prix_c < round(base * 0.9) then return 'remise'; end if;
  if p_prix_c > round(base * 1.5) then return 'devis'; end if;
  if p_prix_c > base and (p_raison not in ('TEMPS', 'ETAT', 'ACCES', 'MATERIEL', 'AUTRE_HAUSSE') or char_length(trim(coalesce(p_note, ''))) < 20) then return 'justification'; end if;
  if p_prix_c < base and p_raison not in ('PROXIMITE', 'LANCEMENT', 'FIDELITE', 'AUTRE_REMISE') then return 'raison'; end if;
  select count(*) into n from public.propositions where reference = p_reference and statut <> 'RETIREE' and cleaneur_id <> auth.uid();
  if n >= 5 then return 'complet'; end if;
  insert into public.propositions (reference, cleaneur_id, prix_c, raison, note, temps_sup_min, autre_horaire, exclusions, expire_le)
  values (p_reference, auth.uid(), p_prix_c, case when p_prix_c = base then '' else coalesce(p_raison, '') end, left(trim(coalesce(p_note, '')), 500),
    coalesce(p_temps_sup_min, 0), p_autre_horaire, left(trim(coalesce(p_exclusions, '')), 300),
    now() + make_interval(mins => public.delai_reponse_min(coalesce(p_autre_horaire, d.creneau))))
  on conflict (reference, cleaneur_id) do update set prix_c = excluded.prix_c, raison = excluded.raison, note = excluded.note,
    temps_sup_min = excluded.temps_sup_min, autre_horaire = excluded.autre_horaire, exclusions = excluded.exclusions,
    statut = 'EN_ATTENTE', expire_le = excluded.expire_le, cree_le = now();
  perform public.notifier(d.client_id, 'client', 'mission', 'important', 'Nouvelle proposition',
    coalesce((select prenom from public.profils where id = auth.uid()), 'Un Cleaneur') || ' · ' || to_char(p_prix_c / 100.0, 'FM999990D00') || ' €', p_reference);
  return 'ok';
end $$;

-- Le Cleaneur retire sa proposition.
create or replace function public.retirer_proposition(p_reference text) returns text language plpgsql security definer set search_path to '' as $$
begin
  update public.propositions set statut = 'RETIREE' where reference = p_reference and cleaneur_id = auth.uid() and statut = 'EN_ATTENTE';
  return case when found then 'ok' else 'introuvable' end;
end $$;

-- Mes propositions (Cleaneur) : statut de chacune.
create or replace function public.mes_propositions() returns table(reference text, prix_c integer, statut text, expire_le timestamptz)
language sql stable security definer set search_path to '' as $$
  select p.reference, p.prix_c, case when p.statut = 'EN_ATTENTE' and p.expire_le < now() then 'EXPIREE' else p.statut end, p.expire_le
  from public.propositions p where p.cleaneur_id = auth.uid() and p.cree_le > now() - interval '30 days' order by p.cree_le desc;
$$;

-- Propositions d'une demande, pour le client (lien de suivi ou connecté).
create or replace function public.propositions_de(p_reference text, p_jeton uuid default null) returns table(
  id uuid, prenom text, niveau integer, note numeric, nb_avis integer, prix_c integer, estimation_c integer, raison text, note_cleaneur text,
  temps_sup_min integer, autre_horaire timestamptz, exclusions text, expire_le timestamptz)
language sql stable security definer set search_path to '' as $$
  select p.id, pr.prenom, coalesce((public.niveau_de(p.cleaneur_id)->>'niveau')::int, 0),
    (select round(avg(a.note)::numeric, 1) from public.avis a where a.cleaneur_id = p.cleaneur_id and a.note is not null and public.avis_revele(a)),
    (select count(*)::int from public.avis a where a.cleaneur_id = p.cleaneur_id and a.note is not null and public.avis_revele(a)),
    p.prix_c, coalesce(d.estimation_initiale_c, d.estimation_c), p.raison, p.note, p.temps_sup_min, p.autre_horaire, p.exclusions, p.expire_le
  from public.propositions p join public.demandes d on d.reference = p.reference left join public.profils pr on pr.id = p.cleaneur_id
  where p.reference = p_reference and p.statut = 'EN_ATTENTE' and p.expire_le > now() and d.statut = 'PUBLIEE'
    and ((p_jeton is not null and d.jeton = p_jeton) or (auth.uid() is not null and d.client_id = auth.uid()))
  order by p.prix_c, p.cree_le;
$$;

-- Le client choisit une proposition : mission confirmée à ce prix (et à l'autre horaire s'il y en a un), les autres sont closes.
create or replace function public.accepter_proposition(p_id uuid, p_jeton uuid default null) returns text
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
  update public.demandes set cleaneur_id = p.cleaneur_id, statut = 'CONFIRMEE',
    estimation_initiale_c = coalesce(estimation_initiale_c, estimation_c), estimation_c = p.prix_c,
    creneau = coalesce(p.autre_horaire, creneau),
    duree_min = greatest(30, duree_min + p.temps_sup_min),
    etapes = etapes || jsonb_build_object('proposition', p.id)
   where id = d.id;
  update public.propositions set statut = 'ACCEPTEE' where id = p.id;
  update public.propositions set statut = 'CLOTUREE' where reference = p.reference and id <> p.id and statut = 'EN_ATTENTE';
  -- Première mission : début des 3 mois de Pro offerts (offre de lancement), comme prendre_mission.
  update public.profils pr set pro_offert_jusqu = now() + interval '3 months'
   where pr.id = p.cleaneur_id and pr.pro_offert_jusqu is null and public.offre_lancement(pr);
  return 'ok';
end $$;

-- Le client refuse une proposition : aucun montant ajouté, la recherche continue.
create or replace function public.refuser_proposition(p_id uuid, p_jeton uuid default null) returns text
language plpgsql security definer set search_path to '' as $$
declare p public.propositions;
begin
  select pp.* into p from public.propositions pp join public.demandes d on d.reference = pp.reference
   where pp.id = p_id and ((p_jeton is not null and d.jeton = p_jeton) or (auth.uid() is not null and d.client_id = auth.uid()));
  if p.id is null then return 'introuvable'; end if;
  update public.propositions set statut = 'REFUSEE' where id = p_id and statut = 'EN_ATTENTE';
  perform public.notifier(p.cleaneur_id, 'cleaneur', 'info', 'standard', 'Proposition non retenue', 'Le client a choisi une autre option.', p.reference);
  return 'ok';
end $$;

-- Prendre une mission : seulement en réservation directe ; en mode candidatures, il faut proposer.
create or replace function public.prendre_mission(p_reference text) returns text language plpgsql security definer set search_path to '' as $$
declare n integer;
begin
  if auth.uid() is null then return 'connexion'; end if;
  if not public.cleaneur_actif() then return 'dossier'; end if;
  if now() < timestamptz '2027-01-01 00:00 Europe/Paris' and not public.est_admin() then return 'ouverture'; end if;
  if not exists (select 1 from public.demandes d where d.reference = p_reference and public.mission_visible(d)) then return 'formule'; end if;
  if not exists (select 1 from public.demandes d where d.reference = p_reference and public.qualifie(d)) then return 'qualification'; end if;
  if exists (select 1 from public.demandes d where d.reference = p_reference and public.periode_fermee(d)) then return 'fermee'; end if;
  if exists (select 1 from public.demandes d where d.reference = p_reference and coalesce(d.choix_cleaneur, 'candidatures') <> 'directe' and not d.urgence) then return 'candidature'; end if;
  update public.demandes set cleaneur_id = auth.uid(), statut = 'CONFIRMEE'
   where reference = p_reference and statut = 'PUBLIEE' and cleaneur_id is null;
  get diagnostics n = row_count;
  if n = 1 then
    update public.profils p set pro_offert_jusqu = now() + interval '3 months'
     where p.id = auth.uid() and p.pro_offert_jusqu is null and public.offre_lancement(p);
  end if;
  return case when n = 1 then 'ok' else 'deja_prise' end;
end $$;

revoke execute on function public.delai_reponse_min(timestamptz) from anon, public;
revoke execute on function public.proposer(text, integer, text, text, integer, timestamptz, text) from anon, public;
revoke execute on function public.retirer_proposition(text) from anon, public;
revoke execute on function public.mes_propositions() from anon, public;
grant execute on function public.proposer(text, integer, text, text, integer, timestamptz, text) to authenticated;
grant execute on function public.retirer_proposition(text) to authenticated;
grant execute on function public.mes_propositions() to authenticated;
grant execute on function public.propositions_de(text, uuid) to anon, authenticated;
grant execute on function public.accepter_proposition(uuid, uuid) to anon, authenticated;
grant execute on function public.refuser_proposition(uuid, uuid) to anon, authenticated;

-- Commission sur l'estimation de la réservation (et non sur le prix accepté).
do $$ declare f text := pg_get_functiondef('public.emettre_factures'::regproc);
begin
  if position('coalesce(d.estimation_initiale_c, d.estimation_c) * com_pb' in f) = 0 then
    execute replace(f, 'com := round(d.estimation_c * com_pb / 10000.0);', 'com := round(coalesce(d.estimation_initiale_c, d.estimation_c) * com_pb / 10000.0);');
  end if;
end $$;
