-- Idées validées par Michael le 25/11/2026 pour l'espace Cleaneur (prompt 4, lot 6), partie base de données.
-- À APPLIQUER SEULEMENT APRÈS SON ACCORD. Même logique à reporter dans les applis (Vincent).
--
-- 1. Proposer le prochain passage : après une mission, le Cleaneur propose au client une date et une heure ; le client est prévenu
--    et réserve en un geste (réservation normale, payée, proposée d'abord à ce Cleaneur), ou refuse.
-- 2. Alertes ciblées : à la mise en ligne d'une demande, seuls les Cleaneurs pour qui elle est vraiment faisable sont prévenus
--    (prestation, secteur, créneaux habituels, pas de période fermée, pas de mission qui se chevauche). Il faut pour cela la position
--    de la demande : colonnes lat / lon, remplies par le site à la réservation (et par les applis ensuite).
-- 3. Bouton de sécurité : le Cleaneur seul dans un logement prévient le support avec sa position ; chaque alerte est gardée.

/* ---------------------------------------------------------------- 1. Prochain passage */
create table if not exists public.propositions_passage (
  id uuid primary key default gen_random_uuid(),
  reference text not null,                 -- mission d'origine
  cleaneur_id uuid not null,
  client_id uuid not null,
  jour date not null,
  heure smallint not null check (heure between 7 and 18),
  statut text not null default 'PROPOSEE' check (statut in ('PROPOSEE', 'ACCEPTEE', 'REFUSEE')),
  cree_le timestamptz not null default now()
);
alter table public.propositions_passage enable row level security;   -- accès seulement par les fonctions ci-dessous

create or replace function public.proposer_prochain_passage(p_reference text, p_jour date, p_heure integer) returns text
 language plpgsql security definer set search_path = '' as $$
declare d public.demandes; prenom text;
begin
  select * into d from public.demandes where reference = p_reference;
  if not found or auth.uid() is null or d.cleaneur_id is distinct from auth.uid() then return 'interdit'; end if;
  if d.statut not in ('A_VALIDER', 'TERMINEE') or d.client_id is null then return 'impossible'; end if;
  if p_jour < current_date + 1 or p_jour > current_date + 90 or p_heure < 7 or p_heure > 18 then return 'date'; end if;
  if exists (select 1 from public.propositions_passage x where x.reference = p_reference and x.statut = 'PROPOSEE') then return 'deja'; end if;
  insert into public.propositions_passage (reference, cleaneur_id, client_id, jour, heure) values (p_reference, auth.uid(), d.client_id, p_jour, p_heure);
  select p.prenom into prenom from public.profils p where p.id = auth.uid();
  perform public.notifier(d.client_id, 'client', 'info', 'important', 'Votre Cleaneur vous propose un prochain passage',
    coalesce(prenom, 'Votre Cleaneur') || ' peut revenir le ' || to_char(p_jour, 'DD/MM/YYYY') || ' à ' || p_heure || ' h. Réservez en un geste depuis la prestation.', p_reference);
  return 'ok';
end $$;

-- Côté client (suivi de la prestation, jeton) : la proposition en cours, s'il y en a une.
create or replace function public.proposition_passage(p_reference text, p_jeton text)
 returns table(id uuid, jour date, heure smallint, cleaneur_id uuid, prenom text, initiale text)
 language sql stable security definer set search_path = '' as $$
  select x.id, x.jour, x.heure, x.cleaneur_id, p.prenom, left(coalesce(p.nom, ''), 1)
  from public.propositions_passage x join public.demandes d on d.reference = x.reference join public.profils p on p.id = x.cleaneur_id
  where x.reference = p_reference and d.jeton::text = p_jeton and x.statut = 'PROPOSEE' and x.jour > current_date
  order by x.cree_le desc limit 1;
$$;

create or replace function public.repondre_passage(p_id uuid, p_jeton text, p_accepte boolean) returns text
 language plpgsql security definer set search_path = '' as $$
declare x public.propositions_passage;
begin
  select pp.* into x from public.propositions_passage pp join public.demandes d on d.reference = pp.reference
  where pp.id = p_id and d.jeton::text = p_jeton and pp.statut = 'PROPOSEE';
  if not found then return 'introuvable'; end if;
  update public.propositions_passage set statut = case when p_accepte then 'ACCEPTEE' else 'REFUSEE' end where id = p_id;
  if not p_accepte then
    perform public.notifier(x.cleaneur_id, 'cleaneur', 'info', 'standard', 'Prochain passage décliné', 'Le client ne souhaite pas ce passage pour le moment.', x.reference);
  end if;
  return 'ok';
end $$;

-- Côté Cleaneur : ses propositions en cours (pour ne pas proposer deux fois).
create or replace function public.mes_propositions_passage()
 returns table(reference text, jour date, heure smallint, statut text) language sql stable security definer set search_path = '' as $$
  select x.reference, x.jour, x.heure, x.statut from public.propositions_passage x
  where x.cleaneur_id = auth.uid() and x.cree_le > now() - interval '90 days' order by x.cree_le desc;
$$;

/* ---------------------------------------------------------------- 2. Alertes ciblées */
alter table public.demandes add column if not exists lat double precision, add column if not exists lon double precision;

create or replace function public.alerter_cleaneurs_cibles() returns trigger language plpgsql security definer set search_path = '' as $$
declare c record; j text; h integer;
begin
  if not (new.statut = 'PUBLIEE' and old.statut is distinct from 'PUBLIEE' and new.cleaneur_id is null) then return new; end if;
  if new.lat is null or new.lon is null or coalesce(new.prelancement, false) then return new; end if;
  if new.choix_cleaneur = 'favori' and new.cleaneur_favori is not null then return new; end if;   -- le Cleaneur demandé est prévenu à part
  if new.creneau is not null then
    j := extract(isodow from new.creneau at time zone 'Europe/Paris')::int::text;
    h := extract(hour from new.creneau at time zone 'Europe/Paris')::int;
  end if;
  for c in
    select p.id from public.profils p
    where p.dossier = 'VALIDE' and p.banni_le is null and p.employeur_id is null and (p.role = 'cleaneur' or 'cleaneur' = any (p.statuts))
      and new.rubrique_id = any (coalesce(p.prestations, '{}'))
      and p.zone_lat is not null and p.zone_lon is not null
      and public.km_entre(p.zone_lat, p.zone_lon, new.lat, new.lon) <= least(coalesce(p.zone_km, 20), 50)
      -- créneaux habituels : s'il en a renseigné, l'heure de la mission doit y être
      and (new.creneau is null or jsonb_typeof(p.disponibilites) is distinct from 'object' or p.disponibilites = '{}'::jsonb
           or coalesce(p.disponibilites -> j, '[]'::jsonb) @> to_jsonb(h))
      and not exists (select 1 from public.periodes_fermees f where f.cleaneur_id = p.id and new.creneau is not null and new.creneau >= f.debut and new.creneau < f.fin)
      and not exists (select 1 from public.demandes x where x.cleaneur_id = p.id and x.statut in ('CONFIRMEE', 'EN_ROUTE', 'SUR_PLACE', 'EN_COURS')
           and new.creneau is not null and x.creneau is not null
           and x.creneau < new.creneau + make_interval(mins => coalesce(new.duree_min, 60))
           and new.creneau < x.creneau + make_interval(mins => coalesce(x.duree_min, 60)))
      and not exists (select 1 from public.favoris fv where fv.client_id = new.client_id and fv.cleaneur_id = p.id)   -- déjà prévenus (prevenir_favoris)
    order by public.km_entre(p.zone_lat, p.zone_lon, new.lat, new.lon)
    limit 40
  loop
    perform public.notifier(c.id, 'cleaneur', 'mission', 'important', 'Nouvelle mission pour vous',
      coalesce(new.ville, '') || case when new.creneau is not null then ' · ' || to_char(new.creneau at time zone 'Europe/Paris', 'DD/MM à HH24"h"MI') else ' · date flexible' end
      || ' · dans vos créneaux et votre secteur', new.reference);
  end loop;
  return new;
end $$;
drop trigger if exists alerter_cleaneurs_cibles on public.demandes;
create trigger alerter_cleaneurs_cibles after update of statut on public.demandes
  for each row execute function public.alerter_cleaneurs_cibles();

/* ---------------------------------------------------------------- 3. Bouton de sécurité */
create table if not exists public.alertes_securite (
  id uuid primary key default gen_random_uuid(),
  cleaneur_id uuid not null,
  reference text,
  lat double precision,
  lon double precision,
  message text,
  cree_le timestamptz not null default now(),
  traitee_le timestamptz
);
alter table public.alertes_securite enable row level security;

create or replace function public.alerte_securite(p_reference text, p_lat double precision, p_lon double precision, p_message text) returns text
 language plpgsql security definer set search_path = '' as $$
declare a record; qui text; ou text;
begin
  if auth.uid() is null or not exists (select 1 from public.profils p where p.id = auth.uid() and (p.role = 'cleaneur' or 'cleaneur' = any (p.statuts))) then return 'interdit'; end if;
  if exists (select 1 from public.alertes_securite x where x.cleaneur_id = auth.uid() and x.cree_le > now() - interval '2 minutes') then return 'deja'; end if;
  insert into public.alertes_securite (cleaneur_id, reference, lat, lon, message) values (auth.uid(), nullif(p_reference, ''), p_lat, p_lon, left(coalesce(p_message, ''), 500));
  select coalesce(p.prenom, '') || ' ' || coalesce(p.nom, '') || ' · ' || coalesce(p.telephone, '') into qui from public.profils p where p.id = auth.uid();
  ou := case when p_lat is not null then 'https://www.google.com/maps?q=' || p_lat || ',' || p_lon else 'position inconnue' end;
  for a in select p.id from public.profils p where p.role = 'admin' loop
    perform public.notifier(a.id, 'client', 'alerte', 'urgent', 'ALERTE SÉCURITÉ Cleaneur',
      left(qui || ' · ' || coalesce(nullif(p_message, ''), 'sans message') || ' · ' || ou, 400), nullif(p_reference, ''));
  end loop;
  return 'ok';
end $$;

revoke all on function public.proposer_prochain_passage(text, date, integer) from public, anon;
revoke all on function public.proposition_passage(text, text) from public;
revoke all on function public.repondre_passage(uuid, text, boolean) from public;
revoke all on function public.mes_propositions_passage() from public, anon;
revoke all on function public.alerte_securite(text, double precision, double precision, text) from public, anon;
grant execute on function public.proposer_prochain_passage(text, date, integer) to authenticated;
grant execute on function public.proposition_passage(text, text) to anon, authenticated;
grant execute on function public.repondre_passage(uuid, text, boolean) to anon, authenticated;
grant execute on function public.mes_propositions_passage() to authenticated;
grant execute on function public.alerte_securite(text, double precision, double precision, text) to authenticated;
