-- Refonte des prestations (20 novembre 2026, audit validé par l'utilisateur), appliqué par Claude.
-- 1. Abonnements des conciergeries : grands comptes t5 (101 à 300 logements) et t6 (plus de 300).
-- 2. Certibiocide « désinfectants » exigé pour les interventions spécialisées hors nuisibles (obligatoire depuis le 1er janvier 2026).
-- 3. Demandes de connexion à un logiciel de gestion (page « Importer mes logements »).
-- 4. Tarifs administrables : versions publiées depuis l'espace de gestion, lues par le site et la fonction « paiement ».
-- 5. Note qualité interne de chaque mission terminée (photos, avis, ponctualité, durée, litige).

-- 1
alter table public.profils drop constraint if exists profils_abonnement_pro_check;
alter table public.profils add constraint profils_abonnement_pro_check check (abonnement_pro = any (array['aucun', 't1', 't2', 't3', 't4', 't5', 't6']));
create or replace function public.choisir_abonnement_pro(t text) returns text language plpgsql security definer set search_path to '' as $$
begin
  if t not in ('aucun', 't1', 't2', 't3', 't4', 't5', 't6') then return 'invalide'; end if;
  update public.profils set abonnement_pro = t,
    abonnement_pro_depuis = case when t = 'aucun' then null when abonnement_pro = 'aucun' then now() else abonnement_pro_depuis end
  where id = auth.uid() and 'pro' = any (statuts);
  return case when found then 'ok' else 'interdit' end;
end $$;

-- 2 (même règle que formationsExigees dans regles.js)
create or replace function public.formations_exigees(d public.demandes) returns text[] language sql stable security definer set search_path to '' as $$
  select array(select distinct x from unnest(
      coalesce(array(select y from unnest(public.qualifs_requises(d.rubrique_id, d.details->>'typeLieuId', d.details->'taches')) y where y = any (public.modules_exiges_loi())), '{}')
      || case when d.rubrique_id = 'special' and coalesce(d.details->>'typeLieuId', '') not in ('cafards', 'punaises', 'rats', 'guepes') then array['biocides'] else array[]::text[] end) x);
$$;

-- 3
create table if not exists public.demandes_connexion (
  id uuid primary key default gen_random_uuid(),
  cree_le timestamptz not null default now(),
  client_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  logiciel text not null check (char_length(logiciel) between 2 and 80),
  logements integer not null default 1 check (logements between 1 and 100000),
  telephone text not null default '' check (char_length(telephone) <= 20),
  message text not null default '' check (char_length(message) <= 500),
  statut text not null default 'A_RAPPELER' check (statut in ('A_RAPPELER', 'EN_COURS', 'CONNECTEE', 'ABANDON'))
);
alter table public.demandes_connexion enable row level security;
drop policy if exists connexion_insert on public.demandes_connexion;
create policy connexion_insert on public.demandes_connexion for insert to authenticated with check (client_id = auth.uid());
drop policy if exists connexion_lecture on public.demandes_connexion;
create policy connexion_lecture on public.demandes_connexion for select to authenticated using (client_id = auth.uid() or public.est_admin());
drop policy if exists connexion_admin on public.demandes_connexion;
create policy connexion_admin on public.demandes_connexion for update to authenticated using (public.est_admin()) with check (public.est_admin());

-- 4
create table if not exists public.tarifs (
  version serial primary key,
  donnees jsonb not null,
  note text not null default '',
  actif boolean not null default false,
  publie_le timestamptz not null default now(),
  publie_par uuid default auth.uid()
);
alter table public.tarifs enable row level security;
drop policy if exists tarifs_lecture on public.tarifs;
create policy tarifs_lecture on public.tarifs for select to anon, authenticated using (actif or public.est_admin());
create or replace function public.publier_tarifs(p_donnees jsonb, p_note text default '') returns integer language plpgsql security definer set search_path to '' as $$
declare v integer;
begin
  if not public.est_admin() then raise exception 'interdit'; end if;
  if jsonb_typeof(p_donnees) <> 'object' or pg_column_size(p_donnees) > 200000 then raise exception 'donnees'; end if;
  update public.tarifs set actif = false where actif;
  insert into public.tarifs (donnees, note, actif) values (p_donnees, left(coalesce(p_note, ''), 200), true) returning version into v;
  return v;
end $$;
revoke all on function public.publier_tarifs(jsonb, text) from public, anon;
grant execute on function public.publier_tarifs(jsonb, text) to authenticated;

-- 5
create table if not exists public.qualite_missions (
  reference text primary key,
  cleaneur_id uuid,
  note smallint not null check (note between 0 and 100),
  details jsonb not null default '{}',
  calcule_le timestamptz not null default now()
);
alter table public.qualite_missions enable row level security;
drop policy if exists qualite_lecture on public.qualite_missions;
create policy qualite_lecture on public.qualite_missions for select to authenticated using (cleaneur_id = auth.uid() or public.est_admin());

create or replace function public.calculer_qualite(p_reference text) returns smallint language plpgsql security definer set search_path to '' as $$
declare d public.demandes; total int; ok int; n numeric; photos int; avis int; ponct int; duree int; litige int; retard numeric; ratio numeric; note smallint;
begin
  select * into d from public.demandes where reference = p_reference;
  if d.id is null or d.statut <> 'TERMINEE' then return null; end if;
  -- Photos et contrôle IA (30) : part des pièces validées « ok » par le contrôle
  select count(*), count(*) filter (where ia_statut = 'ok') into total, ok from public.controles_pieces where reference = p_reference;
  photos := case when total = 0 then 15 else round(30.0 * ok / total) end;
  -- Avis du client (30) : note sur 5 ; sans avis, 24 (4 sur 5)
  select a.note into n from public.avis a where a.reference = p_reference order by a.cree_le desc limit 1;
  avis := case when n is null then 24 else round(30.0 * least(5, greatest(0, n)) / 5) end;
  -- Ponctualité (15) : arrivée confirmée au plus 30 min après l'heure prévue (tolérance existante)
  retard := extract(epoch from ((d.etapes->>'sur_place')::timestamptz - d.creneau)) / 60;
  ponct := case when retard is null or d.flexible then 15 when retard <= 30 then 15 when retard <= 60 then 8 else 0 end;
  -- Durée réelle (15) : entre 80 et 130 % du temps planifié
  ratio := extract(epoch from ((d.etapes->>'fin')::timestamptz - (d.etapes->>'debut')::timestamptz)) / 60 / nullif(d.duree_min, 0);
  duree := case when ratio is null then 15 when ratio between 0.8 and 1.3 then 15 when ratio between 0.6 and 1.6 then 8 else 0 end;
  -- Litige (10) : aucun litige, ou litige refusé
  litige := case when exists (select 1 from public.litiges l where l.reference = p_reference and l.statut <> 'REFUSE') then 0 else 10 end;
  note := least(100, photos + avis + ponct + duree + litige);
  insert into public.qualite_missions (reference, cleaneur_id, note, details, calcule_le)
    values (p_reference, d.cleaneur_id, note, jsonb_build_object('photos', photos, 'avis', avis, 'ponctualite', ponct, 'duree', duree, 'litige', litige), now())
  on conflict (reference) do update set note = excluded.note, details = excluded.details, cleaneur_id = excluded.cleaneur_id, calcule_le = now();
  return note;
end $$;
revoke all on function public.calculer_qualite(text) from public, anon, authenticated;

create or replace function public.qualite_apres_mission() returns trigger language plpgsql security definer set search_path to '' as $$
begin
  if new.statut = 'TERMINEE' and old.statut is distinct from 'TERMINEE' then perform public.calculer_qualite(new.reference); end if;
  return new;
end $$;
drop trigger if exists qualite_fin on public.demandes;
create trigger qualite_fin after update of statut on public.demandes for each row execute function public.qualite_apres_mission();

create or replace function public.qualite_apres_avis() returns trigger language plpgsql security definer set search_path to '' as $$
begin perform public.calculer_qualite(new.reference); return new; end $$;
drop trigger if exists qualite_avis on public.avis;
create trigger qualite_avis after insert or update on public.avis for each row execute function public.qualite_apres_avis();
create or replace function public.qualite_apres_litige() returns trigger language plpgsql security definer set search_path to '' as $$
begin perform public.calculer_qualite(new.reference); return new; end $$;
drop trigger if exists qualite_litige on public.litiges;
create trigger qualite_litige after insert or update of statut on public.litiges for each row execute function public.qualite_apres_litige();

-- Note qualité moyenne des 10 dernières missions d'un Cleaneur (administration).
create or replace function public.qualite_cleaneur(p_cleaneur uuid) returns numeric language sql stable security definer set search_path to '' as $$
  select case when public.est_admin() or p_cleaneur = auth.uid() then (select round(avg(note), 1) from (select note from public.qualite_missions where cleaneur_id = p_cleaneur order by calcule_le desc limit 10) s) end;
$$;

-- Appliqué le 20/11/2026 après le contrôle de sécurité : fonctions de déclenchement non appelables, score qualité réservé aux comptes connectés.
revoke execute on function public.qualite_apres_avis(), public.qualite_apres_litige(), public.qualite_apres_mission() from public, anon, authenticated;
revoke execute on function public.qualite_cleaneur(uuid) from public, anon;
grant execute on function public.qualite_cleaneur(uuid) to authenticated;
