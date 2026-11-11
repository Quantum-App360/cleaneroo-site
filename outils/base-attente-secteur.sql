-- « Être prévenu » (11 novembre 2026, repris de l'appli iPhone de Vincent : Coverage.swift).
-- Une prestation se réserve à une adresse dès qu'au moins un Cleaneur validé, qui propose cette prestation,
-- couvre l'adresse (son périmètre, au plus 50 km). Sinon le client demande à être prévenu : ces demandes
-- montrent à l'administration où recruter. Les prestations spécialisées ne sont jamais bloquées.

alter table public.profils add column if not exists zone_lat double precision;
alter table public.profils add column if not exists zone_lon double precision;

create table if not exists public.attente_secteur (
  id uuid primary key default gen_random_uuid(),
  cree_le timestamptz not null default now(),
  rubrique_id text not null check (char_length(rubrique_id) between 2 and 30),
  code_postal text check (code_postal ~ '^[0-9]{5}$'),
  ville text not null check (char_length(ville) between 1 and 80),
  lat double precision not null check (lat between 41 and 52),
  lon double precision not null check (lon between -6 and 10),
  prenom text check (char_length(prenom) <= 60),
  email text check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(email) <= 120),
  telephone text check (char_length(telephone) <= 20),
  client_id uuid references auth.users(id) on delete set null,
  source text not null default 'site' check (source in ('site', 'appli')),
  prevenu_le timestamptz
);
alter table public.attente_secteur enable row level security;
-- Lecture : l'administration seulement. Écriture : seulement par la fonction rejoindre_attente.
drop policy if exists attente_admin on public.attente_secteur;
create policy attente_admin on public.attente_secteur for select using (public.est_admin());
create index if not exists attente_secteur_ouvertes on public.attente_secteur (rubrique_id) where prevenu_le is null;

-- Distance à vol d'oiseau (km).
create or replace function public.km_entre(lat1 double precision, lon1 double precision, lat2 double precision, lon2 double precision)
returns double precision language sql immutable set search_path to '' as $$
  select 6371 * 2 * asin(sqrt(power(sin(radians(lat2 - lat1) / 2), 2)
    + cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lon2 - lon1) / 2), 2)));
$$;

-- Nombre de Cleaneurs validés qui couvrent cette adresse pour cette prestation (aucune donnée personnelle renvoyée).
create or replace function public.secteur_couvert(p_rubrique text, p_lat double precision, p_lon double precision)
returns integer language sql stable security definer set search_path to '' as $$
  select case when p_rubrique = 'special' then 1 else (
    select count(*)::int from public.profils p
    where p.dossier = 'VALIDE' and p.banni_le is null
      and (p.role = 'cleaneur' or 'cleaneur' = any(p.statuts))
      and p_rubrique = any(p.prestations)
      and p.zone_lat is not null and p.zone_lon is not null
      and public.km_entre(p.zone_lat, p.zone_lon, p_lat, p_lon) <= least(coalesce(p.zone_km, 20), 50)
  ) end;
$$;
grant execute on function public.secteur_couvert(text, double precision, double precision) to anon, authenticated;

-- « Être prévenu » : une seule demande ouverte par prestation et par adresse (à moins d'1 km), mise à jour sinon.
create or replace function public.rejoindre_attente(p_rubrique text, p_code_postal text, p_ville text, p_lat double precision, p_lon double precision,
  p_prenom text, p_email text, p_telephone text, p_source text default 'site')
returns uuid language plpgsql security definer set search_path to '' as $$
declare v_id uuid;
begin
  if coalesce(trim(p_email), '') = '' and auth.uid() is null then raise exception 'E-mail obligatoire'; end if;
  select a.id into v_id from public.attente_secteur a
   where a.prevenu_le is null and a.rubrique_id = p_rubrique
     and (a.client_id = auth.uid() or lower(a.email) = lower(trim(p_email)))
     and public.km_entre(a.lat, a.lon, p_lat, p_lon) < 1 limit 1;
  if v_id is not null then
    update public.attente_secteur set cree_le = now() where id = v_id;
    return v_id;
  end if;
  insert into public.attente_secteur (rubrique_id, code_postal, ville, lat, lon, prenom, email, telephone, client_id, source)
  values (p_rubrique, nullif(p_code_postal, ''), p_ville, p_lat, p_lon, nullif(trim(p_prenom), ''), nullif(lower(trim(p_email)), ''),
          nullif(trim(p_telephone), ''), auth.uid(), case when p_source = 'appli' then 'appli' else 'site' end)
  returning id into v_id;
  return v_id;
end $$;
grant execute on function public.rejoindre_attente(text, text, text, double precision, double precision, text, text, text, text) to anon, authenticated;

-- Dès qu'un Cleaneur devient disponible dans un secteur (dossier validé, zone ou prestations modifiées),
-- les demandes en attente qu'il couvre sont marquées « à prévenir » (date prevenu_le).
create or replace function public.couvrir_attentes() returns trigger language plpgsql security definer set search_path to '' as $$
begin
  if new.dossier = 'VALIDE' and new.banni_le is null and new.zone_lat is not null then
    update public.attente_secteur a set prevenu_le = now()
     where a.prevenu_le is null and a.rubrique_id = any(new.prestations)
       and public.km_entre(new.zone_lat, new.zone_lon, a.lat, a.lon) <= least(coalesce(new.zone_km, 20), 50);
  end if;
  return new;
end $$;
drop trigger if exists couvrir_attentes on public.profils;
create trigger couvrir_attentes after insert or update of dossier, zone_lat, zone_lon, zone_km, prestations, banni_le on public.profils
  for each row execute function public.couvrir_attentes();

-- Administration : où recruter (demandes en attente et pré-réservations, par ville et par prestation).
create or replace function public.secteurs_a_recruter()
returns table (ville text, rubrique_id text, en_attente int, pre_reservations int, a_prevenir int)
language sql stable security definer set search_path to '' as $$
  with a as (
    select initcap(trim(x.ville)) v, x.rubrique_id r, count(*) filter (where x.prevenu_le is null) n, count(*) filter (where x.prevenu_le is not null) p
      from public.attente_secteur x group by 1, 2),
  d as (
    select initcap(trim(y.ville)) v, y.rubrique_id r, count(*) n from public.demandes y
     where y.prelancement and coalesce(y.statut::text, '') <> 'ANNULEE' group by 1, 2)
  select coalesce(a.v, d.v), coalesce(a.r, d.r), coalesce(a.n, 0)::int, coalesce(d.n, 0)::int, coalesce(a.p, 0)::int
    from a full join d on a.v = d.v and a.r = d.r
   where public.est_admin()
   order by coalesce(a.n, 0) + coalesce(d.n, 0) desc, 1, 2;
$$;
grant execute on function public.secteurs_a_recruter() to authenticated;
grant update (zone_lat, zone_lon) on public.profils to authenticated;
