-- « Ma demande compte » (26/11/2026, validé par Michael) : la liste d'attente devient une vraie pré-réservation.
-- 1. La demande complète est gardée (sans paiement), avec sa place dans la file du secteur.
-- 2. Compteur public et anonyme des demandes qui attendent près d'une adresse (aucun nom, seulement des nombres).
-- 3. Ces demandes servent au recrutement : la page « Devenir Cleaneur » montre celles qui attendent dans une zone.
-- 4. Accès prioritaire : quand le secteur peut être servi (ouverture des réservations ou Cleaneur validé), les inscrits sont
--    prévenus (notification, e-mail par la fonction « attente ») et ont 24 h pour réserver avant tout le monde dans ce secteur.
-- Rien n'est payé ni bloqué avant l'ouverture. Le prix n'est jamais enregistré ici : il est recalculé au moment de payer.

-- Rayon d'un secteur (km) pour la file, le compteur et la priorité.
create or replace function public.attente_km() returns double precision language sql immutable set search_path to '' as $$ select 15::double precision $$;

alter table public.attente_secteur add column if not exists motif text not null default 'secteur';
alter table public.attente_secteur drop constraint if exists attente_motif_check;
alter table public.attente_secteur add constraint attente_motif_check check (motif in ('ouverture', 'secteur'));
alter table public.attente_secteur add column if not exists brouillon jsonb;
alter table public.attente_secteur drop constraint if exists attente_brouillon_check;
alter table public.attente_secteur add constraint attente_brouillon_check check (brouillon is null or octet_length(brouillon::text) <= 40000);
alter table public.attente_secteur add column if not exists regulier boolean not null default false;
alter table public.attente_secteur add column if not exists libelle text check (char_length(libelle) <= 80);
alter table public.attente_secteur add column if not exists langue text not null default 'fr';
alter table public.attente_secteur drop constraint if exists attente_langue_check;
alter table public.attente_secteur add constraint attente_langue_check check (langue in ('fr', 'en', 'it', 'es'));
alter table public.attente_secteur add column if not exists jeton text not null default encode(extensions.gen_random_bytes(18), 'hex');
create unique index if not exists attente_secteur_jeton on public.attente_secteur (jeton);
alter table public.attente_secteur add column if not exists priorite_jusqu timestamptz;
alter table public.attente_secteur add column if not exists email_envoye_le timestamptz;
alter table public.attente_secteur add column if not exists reprise_le timestamptz;

/** Place dans la file : demandes plus anciennes de la même prestation, encore en attente, dans le secteur. */
create or replace function public.attente_rang(a public.attente_secteur) returns jsonb language sql stable security definer set search_path to '' as $$
  select jsonb_build_object(
    'rang', 1 + count(*) filter (where x.cree_le < a.cree_le or (x.cree_le = a.cree_le and x.id < a.id)),
    'total', count(*))
  from public.attente_secteur x
  where x.rubrique_id = a.rubrique_id and x.reprise_le is null and x.prevenu_le is null
    and public.km_entre(x.lat, x.lon, a.lat, a.lon) <= public.attente_km();
$$;
revoke all on function public.attente_rang(public.attente_secteur) from public, anon, authenticated;

/** Mise en attente avec la demande complète. Une seule par prestation et par adresse (à moins d'1 km) : mise à jour, place gardée. */
create or replace function public.mettre_en_attente(p_rubrique text, p_code_postal text, p_ville text, p_lat double precision, p_lon double precision,
  p_prenom text, p_email text, p_telephone text, p_motif text, p_regulier boolean, p_libelle text, p_langue text, p_brouillon jsonb, p_source text default 'site')
returns jsonb language plpgsql security definer set search_path to '' as $$
declare v public.attente_secteur; br jsonb;
begin
  if coalesce(trim(p_email), '') = '' and auth.uid() is null then raise exception 'E-mail obligatoire'; end if;
  if p_lat is null or p_lon is null then raise exception 'position'; end if;
  -- Ni acceptation des conditions ni remises gardées : elles se redonnent au moment de payer.
  br := case when jsonb_typeof(p_brouillon) = 'object' then p_brouillon - 'cgv' - 'abonnePro' - 'attenteJeton' - 'fraisOfferts' - 'passagesEnvoyes' - 'groupePaiement' else null end;
  select * into v from public.attente_secteur a
   where a.prevenu_le is null and a.reprise_le is null and a.rubrique_id = p_rubrique
     and ((auth.uid() is not null and a.client_id = auth.uid()) or (coalesce(trim(p_email), '') <> '' and lower(a.email) = lower(trim(p_email))))
     and public.km_entre(a.lat, a.lon, p_lat, p_lon) < 1
   order by a.cree_le limit 1;
  if v.id is not null then
    update public.attente_secteur set brouillon = coalesce(br, brouillon), motif = case when p_motif = 'ouverture' then 'ouverture' else 'secteur' end,
      regulier = coalesce(p_regulier, regulier), libelle = coalesce(nullif(left(trim(p_libelle), 80), ''), libelle),
      langue = case when p_langue in ('fr', 'en', 'it', 'es') then p_langue else langue end,
      prenom = coalesce(nullif(trim(p_prenom), ''), prenom), telephone = coalesce(nullif(trim(p_telephone), ''), telephone),
      client_id = coalesce(client_id, auth.uid())
     where id = v.id returning * into v;
  else
    insert into public.attente_secteur (rubrique_id, code_postal, ville, lat, lon, prenom, email, telephone, client_id, source,
      motif, brouillon, regulier, libelle, langue)
    values (p_rubrique, nullif(p_code_postal, ''), p_ville, p_lat, p_lon, nullif(trim(p_prenom), ''), nullif(lower(trim(p_email)), ''),
      nullif(trim(p_telephone), ''), auth.uid(), case when p_source = 'appli' then 'appli' else 'site' end,
      case when p_motif = 'ouverture' then 'ouverture' else 'secteur' end, br, coalesce(p_regulier, false),
      nullif(left(trim(p_libelle), 80), ''), case when p_langue in ('fr', 'en', 'it', 'es') then p_langue else 'fr' end)
    returning * into v;
  end if;
  return jsonb_build_object('jeton', v.jeton, 'ville', v.ville, 'quartier', public.attente_quartier(v.lat, v.lon, null)) || public.attente_rang(v);
end $$;
grant execute on function public.mettre_en_attente(text, text, text, double precision, double precision, text, text, text, text, boolean, text, text, jsonb, text) to anon, authenticated;

-- Ancienne inscription (appli, carte des secteurs) : la place dans la file n'est plus perdue quand on se réinscrit.
create or replace function public.rejoindre_attente(p_rubrique text, p_code_postal text, p_ville text, p_lat double precision, p_lon double precision,
  p_prenom text, p_email text, p_telephone text, p_source text default 'site')
returns uuid language plpgsql security definer set search_path to '' as $$
declare r jsonb;
begin
  r := public.mettre_en_attente(p_rubrique, p_code_postal, p_ville, p_lat, p_lon, p_prenom, p_email, p_telephone, 'secteur', null, null, null, null, p_source);
  return (select id from public.attente_secteur where jeton = r->>'jeton');
end $$;

/** Une demande en attente, pour son lien personnel (sans compte). */
create or replace function public.attente_vue(a public.attente_secteur, avec_brouillon boolean) returns jsonb language sql stable security definer set search_path to '' as $$
  select jsonb_build_object('jeton', a.jeton, 'rubrique_id', a.rubrique_id, 'ville', a.ville, 'motif', a.motif, 'libelle', a.libelle,
    'cree_le', a.cree_le, 'prevenu_le', a.prevenu_le, 'priorite_jusqu', a.priorite_jusqu, 'reprise_le', a.reprise_le, 'regulier', a.regulier)
    || case when a.prevenu_le is null then public.attente_rang(a) else '{}'::jsonb end
    || case when avec_brouillon then jsonb_build_object('brouillon', a.brouillon, 'prenom', a.prenom, 'email', a.email, 'telephone', a.telephone,
         'code_postal', a.code_postal, 'lat', a.lat, 'lon', a.lon) else '{}'::jsonb end;
$$;
revoke all on function public.attente_vue(public.attente_secteur, boolean) from public, anon, authenticated;

create or replace function public.attente_par_jeton(p_jeton text) returns jsonb language sql stable security definer set search_path to '' as $$
  select public.attente_vue(a, true) from public.attente_secteur a where a.jeton = p_jeton and char_length(p_jeton) >= 30;
$$;
grant execute on function public.attente_par_jeton(text) to anon, authenticated;

/** Demandes en attente du client connecté (par compte ou par e-mail). */
create or replace function public.mes_attentes() returns jsonb language sql stable security definer set search_path to '' as $$
  select coalesce(jsonb_agg(public.attente_vue(a, false) order by a.cree_le desc), '[]'::jsonb)
    from public.attente_secteur a
   where auth.uid() is not null and a.reprise_le is null
     and (a.client_id = auth.uid() or lower(a.email) = lower((select u.email from auth.users u where u.id = auth.uid())));
$$;
grant execute on function public.mes_attentes() to authenticated;

/** Quitter la liste (lien personnel). */
create or replace function public.quitter_attente(p_jeton text) returns text language sql security definer set search_path to '' as $$
  with d as (delete from public.attente_secteur where jeton = p_jeton and char_length(p_jeton) >= 30 and reprise_le is null returning 1)
  select case when exists (select 1 from d) then 'ok' else 'introuvable' end;
$$;
grant execute on function public.quitter_attente(text) to anon, authenticated;

/** Compteur public et anonyme : demandes qui attendent un Cleaneur près d'un point (aucun nom, seulement des nombres). */
create or replace function public.attente_quartier(p_lat double precision, p_lon double precision, p_km double precision default null)
returns jsonb language sql stable security definer set search_path to '' as $$
  with x as (
    select a.rubrique_id, a.regulier from public.attente_secteur a
     where a.reprise_le is null and (a.prevenu_le is null or a.priorite_jusqu > now())
       and p_lat is not null and p_lon is not null
       and public.km_entre(a.lat, a.lon, p_lat, p_lon) <= least(greatest(coalesce(p_km, public.attente_km()), 1), 50))
  select jsonb_build_object('total', (select count(*) from x), 'reguliers', (select count(*) from x where regulier),
    'km', least(greatest(coalesce(p_km, public.attente_km()), 1), 50),
    'prestations', coalesce((select jsonb_agg(jsonb_build_object('rubrique_id', r, 'n', n) order by n desc, r)
      from (select rubrique_id r, count(*) n from x group by 1) t), '[]'::jsonb));
$$;
grant execute on function public.attente_quartier(double precision, double precision, double precision) to anon, authenticated;

/** Priorité en cours dans ce secteur pour cette prestation : fin de la priorité, ou null (aucune, ou c'est vous l'inscrit). */
create or replace function public.priorite_secteur(p_rubrique text, p_lat double precision, p_lon double precision, p_jeton text default null)
returns timestamptz language sql stable security definer set search_path to '' as $$
  select case when exists (
      select 1 from public.attente_secteur a where a.priorite_jusqu > now() and a.reprise_le is null and a.rubrique_id = p_rubrique
         and public.km_entre(a.lat, a.lon, p_lat, p_lon) <= public.attente_km()
         and (a.jeton = p_jeton or (auth.uid() is not null and a.client_id = auth.uid())))
    then null else (
      select max(a.priorite_jusqu) from public.attente_secteur a where a.priorite_jusqu > now() and a.reprise_le is null and a.rubrique_id = p_rubrique
         and p_lat is not null and public.km_entre(a.lat, a.lon, p_lat, p_lon) <= public.attente_km()) end;
$$;
grant execute on function public.priorite_secteur(text, double precision, double precision, text) to anon, authenticated;

-- Pendant la priorité, une nouvelle demande dans le secteur doit venir d'un inscrit (lien personnel, compte ou e-mail).
create or replace function public.verifier_priorite_attente() returns trigger language plpgsql security definer set search_path to '' as $$
declare la double precision := coalesce(new.lat, (new.acces->'vehicule'->>'lat')::double precision);
        lo double precision := coalesce(new.lon, (new.acces->'vehicule'->>'lon')::double precision);
begin
  if la is null or lo is null or new.rubrique_id is null then return new; end if;
  if not exists (select 1 from public.attente_secteur a where a.priorite_jusqu > now() and a.reprise_le is null
                  and a.rubrique_id = new.rubrique_id and public.km_entre(a.lat, a.lon, la, lo) <= public.attente_km()) then return new; end if;
  if coalesce(auth.role(), '') = 'authenticated' and public.est_admin() then return new; end if;
  if exists (select 1 from public.attente_secteur a where a.priorite_jusqu > now() and a.rubrique_id = new.rubrique_id
              and (a.jeton = new.details->>'attenteJeton' or (new.client_id is not null and a.client_id = new.client_id)
                   or (coalesce(new.email, '') <> '' and a.email = lower(new.email)))) then return new; end if;
  raise exception 'priorite' using hint = 'Secteur réservé aux inscrits de la liste d''attente pendant 24 h.';
end $$;
drop trigger if exists demandes_priorite_attente on public.demandes;
create trigger demandes_priorite_attente before insert on public.demandes for each row execute function public.verifier_priorite_attente();

-- Demande réservée par un inscrit : sa place dans la liste est terminée (« reprise »).
create or replace function public.reprendre_attente_apres_demande() returns trigger language plpgsql security definer set search_path to '' as $$
begin
  update public.attente_secteur a set reprise_le = now()
   where a.reprise_le is null and a.rubrique_id = new.rubrique_id
     and (a.jeton = new.details->>'attenteJeton'
       or (a.prevenu_le is not null and ((new.client_id is not null and a.client_id = new.client_id) or (coalesce(new.email, '') <> '' and a.email = lower(new.email)))));
  return new;
end $$;
drop trigger if exists demandes_reprise_attente on public.demandes;
create trigger demandes_reprise_attente after insert on public.demandes for each row execute function public.reprendre_attente_apres_demande();

/** Toutes les 15 minutes, à l'ouverture et à chaque Cleaneur validé : les demandes qui peuvent être servies sont prévenues,
 *  dans l'ordre de la file, avec 24 h de priorité. Réservations fermées : rien ne bouge. */
create or replace function public.traiter_attentes() returns integer language plpgsql security definer set search_path to '' as $$
declare a record; n integer := 0;
begin
  if not public.reservations_ouvertes() then return 0; end if;
  for a in select * from public.attente_secteur x where x.prevenu_le is null and x.reprise_le is null order by x.cree_le loop
    if public.secteur_couvert(a.rubrique_id, a.lat, a.lon) > 0 then
      update public.attente_secteur set prevenu_le = now(), priorite_jusqu = now() + interval '24 hours' where id = a.id;
      begin
        perform public.notifier(a.client_id, 'client', 'secteur', 'important', 'Votre demande peut être réservée',
          'Un Cleaneur vérifié intervient maintenant à ' || a.ville || '. Vous avez la priorité pendant 24 h : choisissez votre créneau.', null);
      exception when others then null; end;
      n := n + 1;
    elsif a.motif = 'ouverture' then
      update public.attente_secteur set motif = 'secteur' where id = a.id;   -- ouvert, mais pas encore de Cleaneur ici
    end if;
  end loop;
  if exists (select 1 from public.attente_secteur where prevenu_le is not null and email_envoye_le is null and email is not null and reprise_le is null) then
    begin
      perform net.http_post(url := 'https://wmxrmnujuqkdgvdtlnai.supabase.co/functions/v1/attente',
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-cle-alertes', (select valeur from public.config_privee where cle = 'alertes')),
        body := jsonb_build_object('action', 'envoyer'));
    exception when others then null; end;
  end if;
  return n;
end $$;
revoke all on function public.traiter_attentes() from public, anon, authenticated;

-- Cleaneur validé (ou zone, prestations modifiées) : les demandes qu'il couvre sont prévenues tout de suite (si c'est ouvert).
create or replace function public.couvrir_attentes() returns trigger language plpgsql security definer set search_path to '' as $$
begin
  if new.dossier = 'VALIDE' and new.banni_le is null and new.zone_lat is not null then perform public.traiter_attentes(); end if;
  return new;
end $$;

-- Ouverture des réservations : les inscrits des secteurs couverts sont prévenus tout de suite.
create or replace function public.ouverture_prevenir_attentes() returns trigger language plpgsql security definer set search_path to '' as $$
begin
  if new.cle = 'reservations_ouvertes' and new.valeur = 'oui' and old.valeur is distinct from 'oui' then perform public.traiter_attentes(); end if;
  return new;
end $$;
drop trigger if exists ouverture_prevenir_attentes on public.infos_cleaneroo;
create trigger ouverture_prevenir_attentes after update of valeur on public.infos_cleaneroo for each row execute function public.ouverture_prevenir_attentes();

select cron.unschedule('attentes') where exists (select 1 from cron.job where jobname = 'attentes');
select cron.schedule('attentes', '*/15 * * * *', 'select public.traiter_attentes()');
