-- Plan de démarchage clients (22 novembre 2026, partie 5 du plan) : zones, codes partenaires et canal d'origine,
-- « Inviter mon client » côté Cleaneur, message aux inscrits « Être prévenu » à l'ouverture d'une zone, pages ville des zones ouvertes.
-- Règle d'or : on ne démarche que là où des Cleaneurs validés peuvent servir.

-- ------------------------------------------------------------------ Zones (rayon d'environ 20 km autour d'une ville)
create table if not exists public.zones (
  id uuid primary key default gen_random_uuid(),
  ville text not null,
  code_postal text not null default '',
  departement text not null default '',
  lat double precision not null,
  lon double precision not null,
  rayon_km integer not null default 20 check (rayon_km between 5 and 60),
  en_pause boolean not null default false,          -- pause décidée à la main (en plus de la pause automatique)
  prevenus_le timestamptz,                          -- inscrits « Être prévenu » prévenus de l'ouverture
  cree_le timestamptz not null default now()
);
alter table public.zones enable row level security;
drop policy if exists zones_admin on public.zones;
create policy zones_admin on public.zones for all to authenticated using (public.est_admin()) with check (public.est_admin());

-- ------------------------------------------------------------------ Partenaires (code saisi à l'inscription ou lien ?code=)
create table if not exists public.partenaires (
  code text primary key check (code ~ '^[A-Z0-9-]{3,20}$'),
  nom text not null,
  type text not null default 'local' check (type in ('local', 'national', 'media', 'autre')),
  zone_id uuid references public.zones (id) on delete set null,
  signe_le date,
  actif boolean not null default true,
  cree_le timestamptz not null default now()
);
alter table public.partenaires enable row level security;
drop policy if exists partenaires_admin on public.partenaires;
create policy partenaires_admin on public.partenaires for all to authenticated using (public.est_admin()) with check (public.est_admin());

-- ------------------------------------------------------------------ Canal d'origine de chaque compte
alter table public.profils add column if not exists canal text check (char_length(canal) <= 40);
alter table public.profils add column if not exists code_partenaire text references public.partenaires (code) on delete set null;
alter table public.profils add column if not exists apporte_par uuid references public.profils (id) on delete set null;
alter table public.profils add column if not exists apporte_le timestamptz;

-- Après nouveau_profil (déclencheur « apres_inscription », même table, ordre alphabétique) : canal, code partenaire et Cleaneur apporteur.
-- Le code saisi dans « Code de parrainage » (site et applis) sert aussi : code partenaire, ou code d'un Cleaneur qui invite son client.
create or replace function public.origine_profil() returns trigger
language plpgsql security definer set search_path = '' as $$
declare m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_code text := upper(left(regexp_replace(coalesce(nullif(m->>'code_partenaire', ''), m->>'code_parrain', ''), '[^A-Za-z0-9-]', '', 'g'), 20));
  v_code_c text := upper(left(regexp_replace(coalesce(nullif(m->>'code_cleaneur', ''), m->>'code_parrain', ''), '[^A-Za-z0-9-]', '', 'g'), 20));
  v_canal text := nullif(left(regexp_replace(coalesce(m->>'canal', ''), '[^A-Za-z0-9_.-]', '', 'g'), 40), '');
  v_app uuid; v_role text;
begin
  select p.role into v_role from public.profils p where p.id = new.id;
  if v_role is null then return new; end if;
  if v_code <> '' and not exists (select 1 from public.partenaires x where x.code = v_code and x.actif) then v_code := ''; end if;
  -- Client invité par son Cleaneur : un nouveau compte client seulement (jamais un compte qui existait déjà).
  if v_role = 'client' and v_code_c <> '' then
    select x.id into v_app from public.profils x where x.code_parrainage = v_code_c and x.role = 'cleaneur' and x.banni_le is null and x.id <> new.id limit 1;
  end if;
  update public.profils p set
    code_partenaire = nullif(v_code, ''),
    apporte_par = v_app, apporte_le = case when v_app is not null then now() end,
    canal = coalesce(v_canal, case when v_app is not null then 'cleaneur' when v_code <> '' then 'partenaire' end)
  where p.id = new.id;
  return new;
exception when others then
  return new;   -- l'origine ne doit jamais empêcher une inscription
end $$;
drop trigger if exists apres_inscription_origine on auth.users;
create trigger apres_inscription_origine after insert on auth.users for each row execute function public.origine_profil();

-- ------------------------------------------------------------------ Commission : clients apportés par le Cleaneur
-- 0 % pendant 12 mois, puis la moitié de la commission normale. Le client paie toujours ses frais de service.
do $$
declare f text := pg_get_functiondef('public.emettre_factures'::regproc);
  a text := 'com_pb := case when public.formule_effective(payeur) = ''pro'' then 1200 else 2000 end;';
begin
  if position('apporte_par' in f) = 0 then
    if position(a in f) = 0 then raise exception 'emettre_factures : ligne de commission introuvable'; end if;
    f := replace(f, a, a || E'\n  -- Client apporté par ce Cleaneur (22/11/2026) : 0 % pendant 12 mois, puis la moitié.\n'
      || E'  if cl.apporte_par is not null and cl.apporte_par in (d.cleaneur_id, payeur) then\n'
      || E'    com_pb := case when cl.apporte_le > coalesce(d.creneau, now()) - interval ''12 months'' then 0 else com_pb / 2 end;\n  end if;');
    execute f;
  end if;
end $$;

-- « Inviter mon client » : les clients apportés par le Cleaneur connecté.
create or replace function public.mes_clients_apportes()
returns table (prenom text, ville text, depuis timestamptz, missions integer, offert_jusqu timestamptz)
language sql stable security definer set search_path = '' as $$
  select p.prenom, coalesce(p.ville, ''), p.apporte_le,
    (select count(*)::int from public.demandes d where d.client_id = p.id and d.cleaneur_id = auth.uid() and d.statut = 'TERMINEE'),
    p.apporte_le + interval '12 months'
  from public.profils p where p.apporte_par = auth.uid() order by p.apporte_le desc limit 200;
$$;
revoke all on function public.mes_clients_apportes() from public, anon;
grant execute on function public.mes_clients_apportes() to authenticated;

-- ------------------------------------------------------------------ État des zones
-- En attente : < 5 Cleaneurs actifs (validés, mission test réussie) ou ménage du logement / location saisonnière non couverts.
-- Ouverte : >= 5 actifs couvrant les deux. Prioritaire : >= 15 actifs, ou >= 30 « Être prévenu », ou un partenaire signé.
-- En pause : décidée à la main, ou plus de 15 % de demandes sans Cleaneur sur 14 jours (au moins 5 demandes).
-- Les demandes sont rattachées à la zone par leur ville ou leur code postal (les demandes n'ont pas de coordonnées).
create or replace function public.calcul_zones()
returns table (id uuid, ville text, code_postal text, departement text, lat double precision, lon double precision, rayon_km integer,
  en_pause boolean, prevenus_le timestamptz, cleaneurs_valides integer, cleaneurs_actifs integer, logement boolean, location boolean,
  attentes integer, partenaires integer, demandes_14j integer, sans_cleaneur_14j integer, etat text)
language sql stable security definer set search_path = '' as $$
  with c as (
    select z.id, count(p.id)::int v, count(p.id) filter (where p.mission_test = 'REUSSIE')::int a,
      coalesce(bool_or(p.mission_test = 'REUSSIE' and 'home' = any (p.prestations)), false) lo,
      coalesce(bool_or(p.mission_test = 'REUSSIE' and 'rental' = any (p.prestations)), false) lc
    from public.zones z left join public.profils p on p.dossier = 'VALIDE' and p.banni_le is null
      and (p.role = 'cleaneur' or 'cleaneur' = any (p.statuts)) and p.zone_lat is not null
      and public.km_entre(z.lat, z.lon, p.zone_lat, p.zone_lon) <= z.rayon_km
    group by z.id),
  a as (
    select z.id, count(x.id)::int n from public.zones z left join public.attente_secteur x on x.prevenu_le is null and x.lat is not null
      and public.km_entre(z.lat, z.lon, x.lat, x.lon) <= z.rayon_km group by z.id),
  d as (
    select z.id, count(y.id)::int n,
      count(y.id) filter (where (y.statut = 'ANNULEE' and y.notes_admin ilike '%pas de remplaçant%')
        or (y.statut in ('VERIFICATION', 'PUBLIEE') and y.creneau < now()))::int s
    from public.zones z left join public.demandes y on y.cree_le > now() - interval '14 days' and not y.prelancement
      and (lower(trim(y.ville)) = lower(trim(z.ville)) or (z.code_postal <> '' and y.code_postal = z.code_postal))
    group by z.id),
  pa as (select z.id, count(x.code)::int n from public.zones z left join public.partenaires x on x.zone_id = z.id and x.actif and x.signe_le is not null group by z.id)
  select z.id, z.ville, z.code_postal, z.departement, z.lat, z.lon, z.rayon_km, z.en_pause, z.prevenus_le,
    c.v, c.a, c.lo, c.lc, a.n, pa.n, d.n, d.s,
    case when z.en_pause or (d.n >= 5 and d.s * 100 > d.n * 15) then 'en_pause'
         when c.a >= 5 and c.lo and c.lc and (c.a >= 15 or a.n >= 30 or pa.n > 0) then 'prioritaire'
         when c.a >= 5 and c.lo and c.lc then 'ouverte'
         else 'en_attente' end
  from public.zones z join c on c.id = z.id join a on a.id = z.id join d on d.id = z.id join pa on pa.id = z.id
  order by z.ville;
$$;
revoke all on function public.calcul_zones() from public, anon, authenticated;

-- Gestion : tableau des zones.
create or replace function public.etat_zones() returns setof jsonb
language sql stable security definer set search_path = '' as $$
  select to_jsonb(z) || jsonb_build_object('a_prevenir', z.attentes > 0 and z.etat in ('ouverte', 'prioritaire'))
  from public.calcul_zones() z where public.est_admin();
$$;
revoke all on function public.etat_zones() from public, anon;
grant execute on function public.etat_zones() to authenticated;

-- Pages ville : les zones ouvertes ou prioritaires (lues par outils/generer_pages.py, sans connexion).
create or replace function public.zones_ouvertes()
returns table (ville text, code_postal text, departement text)
language sql stable security definer set search_path = '' as $$
  select z.ville, z.code_postal, z.departement from public.calcul_zones() z where z.etat in ('ouverte', 'prioritaire');
$$;
grant execute on function public.zones_ouvertes() to anon, authenticated;

-- Ouverture d'une zone : les inscrits « Être prévenu » du rayon sont marqués prévenus et reçoivent une notification dans
-- leur espace s'ils ont un compte. La liste est renvoyée pour leur écrire (WhatsApp ou e-mail) depuis la gestion.
create or replace function public.prevenir_zone(p_zone uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare z record; liste jsonb; x record;
begin
  if not public.est_admin() then raise exception 'interdit'; end if;
  select * into z from public.calcul_zones() c where c.id = p_zone;
  if z.id is null then raise exception 'zone'; end if;
  if z.etat not in ('ouverte', 'prioritaire') then return jsonb_build_object('erreur', 'fermee'); end if;
  select coalesce(jsonb_agg(jsonb_build_object('prenom', a.prenom, 'email', a.email, 'telephone', a.telephone, 'rubrique_id', a.rubrique_id, 'ville', a.ville)), '[]'::jsonb)
    into liste from public.attente_secteur a
   where a.prevenu_le is null and a.lat is not null and public.km_entre(z.lat, z.lon, a.lat, a.lon) <= z.rayon_km;
  for x in select distinct a.client_id from public.attente_secteur a
            where a.prevenu_le is null and a.client_id is not null and a.lat is not null and public.km_entre(z.lat, z.lon, a.lat, a.lon) <= z.rayon_km loop
    begin
      perform public.notifier(x.client_id, 'client', 'secteur', 'important', 'Cleaneroo arrive près de chez vous',
        'Des Cleaneurs vérifiés interviennent maintenant à ' || z.ville || ' et alentours. Réservez quand vous voulez.', null);
    exception when others then null; end;
  end loop;
  update public.attente_secteur a set prevenu_le = now()
   where a.prevenu_le is null and a.lat is not null and public.km_entre(z.lat, z.lon, a.lat, a.lon) <= z.rayon_km;
  update public.zones set prevenus_le = now() where id = p_zone;
  return jsonb_build_object('liste', liste);
end $$;
revoke all on function public.prevenir_zone(uuid) from public, anon;
grant execute on function public.prevenir_zone(uuid) to authenticated;

-- Partenaires : comptes et prestations par code (gestion).
create or replace function public.stats_partenaires() returns setof jsonb
language sql stable security definer set search_path = '' as $$
  select to_jsonb(x) || jsonb_build_object(
    'comptes', (select count(*) from public.profils p where p.code_partenaire = x.code),
    'clients_actifs', (select count(distinct d.client_id) from public.demandes d join public.profils p on p.id = d.client_id
                        where p.code_partenaire = x.code and d.statut = 'TERMINEE'),
    'zone', (select z.ville from public.zones z where z.id = x.zone_id))
  from public.partenaires x where public.est_admin() order by x.cree_le desc;
$$;
revoke all on function public.stats_partenaires() from public, anon;
grant execute on function public.stats_partenaires() to authenticated;

-- Canaux d'origine (gestion) : comptes et clients ayant commandé, par canal.
create or replace function public.stats_canaux() returns table (canal text, comptes integer, clients_actifs integer)
language sql stable security definer set search_path = '' as $$
  select coalesce(p.canal, 'direct'), count(*)::int,
    count(*) filter (where exists (select 1 from public.demandes d where d.client_id = p.id and d.statut = 'TERMINEE'))::int
  from public.profils p where public.est_admin() and p.role = 'client' group by 1 order by 2 desc;
$$;
revoke all on function public.stats_canaux() from public, anon;
grant execute on function public.stats_canaux() to authenticated;
