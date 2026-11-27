-- Badge « Logement contrôlé Cleaneroo » repensé (27/11/2026, validé par Michael) : la preuve de propreté du séjour, pour le voyageur.
-- 1. Badge toujours vrai : actif seulement si un ménage contrôlé a été fait dans les 30 derniers jours, à sa vraie date ;
--    jamais le nom donné au bien par le propriétaire (seulement le type de logement et la ville).
-- 2. Affichette à imprimer (site) ; 3. conseils au propriétaire (site, jamais de lien dans Airbnb ou Booking).
-- 4. Un voyageur devient client : code d'invitation du bien (ne révèle rien du propriétaire), reconnu comme un code de parrainage.
-- 5. Options : photos « après » du dernier ménage (si le propriétaire l'active) ; alerte d'un voyageur au propriétaire
--    (photo et mot, seulement une notification : ni argent ni engagement de Cleaneroo).

alter table public.biens add column if not exists badge_photos boolean not null default false;
alter table public.biens add column if not exists code_invitation text;
create unique index if not exists biens_code_invitation on public.biens (code_invitation) where code_invitation is not null;

/** Code d'invitation d'un bien : « B » + 7 caractères, sans rapport avec le nom du propriétaire. */
create or replace function public.nouveau_code_invitation() returns text language plpgsql volatile set search_path to '' as $$
declare c text;
begin
  loop
    c := 'B' || (select string_agg(substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 1 + floor(random() * 31)::int, 1), '') from generate_series(1, 7));
    exit when not exists (select 1 from public.biens where code_invitation = c) and not exists (select 1 from public.profils where code_parrainage = c);
  end loop;
  return c;
end $$;

/** Ménages terminés d'un bien, avec leur vraie date (dernière photo « après », sinon le créneau). */
create or replace function public.menages_bien(p_client uuid, p_bien text)
returns table (reference text, fait_le timestamptz) language sql stable security definer set search_path to '' as $$
  select d.reference, coalesce((select max(cp.photo_apres_le) from public.controles_pieces cp where cp.reference = d.reference), d.creneau)
    from public.demandes d
   where d.client_id = p_client and d.details->>'logementId' = p_bien and d.statut = 'TERMINEE';
$$;
revoke all on function public.menages_bien(uuid, text) from public, anon, authenticated;

/** Page publique du badge. */
create or replace function public.badge_controle(p_code uuid) returns json language sql stable security definer set search_path to '' as $$
  with b as (select * from public.biens where badge = p_code),
  m as (select x.* from b, public.menages_bien(b.client_id, b.id) x),
  der as (select reference, fait_le from m order by fait_le desc nulls last limit 1),
  c as (select cp.* from public.controles_pieces cp where cp.reference in (select reference from m))
  select case when (select count(*) from b) = 0 then null else json_build_object(
    'ville', (select donnees->>'ville' from b),
    'type', (select coalesce(nullif(donnees->>'typeLogementId', ''), 'Logement') from b),
    'dernier', (select fait_le from der),
    'actif', coalesce((select fait_le > now() - interval '30 days' from der), false),
    'menages_90j', (select count(*) from m where fait_le > now() - interval '90 days'),
    'pieces', (select count(*) from c where photo_apres is not null),
    'premier_coup', (select count(*) from c where ia_statut = 'ok' and essais <= 1),
    'invitation', (select code_invitation from b),
    'photos', case when (select badge_photos from b) and coalesce((select fait_le > now() - interval '30 days' from der), false) then
      (select coalesce(json_agg(json_build_object('nom', cp.nom, 'chemin', cp.photo_apres) order by cp.ordre), '[]'::json)
         from public.controles_pieces cp where cp.reference = (select reference from der) and cp.photo_apres is not null)
      else '[]'::json end) end;
$$;
grant execute on function public.badge_controle(uuid) to anon, authenticated;

/** Photo « après » montrée sur un badge (propriétaire d'accord, dernier ménage de moins de 30 jours) : lisible sans compte. */
create or replace function public.photo_badge_publique(p_chemin text) returns boolean language sql stable security definer set search_path to '' as $$
  select exists (
    select 1 from public.controles_pieces cp
      join public.demandes d on d.reference = cp.reference
      join public.biens b on b.client_id = d.client_id and b.id = d.details->>'logementId' and b.badge_photos
     where cp.photo_apres = p_chemin and d.statut = 'TERMINEE'
       and d.reference = (select x.reference from public.menages_bien(b.client_id, b.id) x order by x.fait_le desc nulls last limit 1)
       and coalesce(cp.photo_apres_le, d.creneau) > now() - interval '30 days');
$$;
grant execute on function public.photo_badge_publique(text) to anon, authenticated;
drop policy if exists "badge : photos publiques" on storage.objects;
create policy "badge : photos publiques" on storage.objects for select to anon, authenticated
  using (bucket_id = 'photos-controles' and public.photo_badge_publique(name));

/** Badge d'un bien, pour son propriétaire (« Mes biens ») : lien, réglages, état, alertes des voyageurs. */
create or replace function public.mon_badge(p_bien text) returns json language plpgsql security definer set search_path to '' as $$
declare b public.biens;
begin
  select * into b from public.biens where id = p_bien and client_id = auth.uid();
  if b.client_id is null then return null; end if;
  if b.badge is null or b.code_invitation is null then
    update public.biens set badge = coalesce(badge, gen_random_uuid()), code_invitation = coalesce(code_invitation, public.nouveau_code_invitation())
     where client_id = b.client_id and id = b.id returning * into b;
  end if;
  return json_build_object('code', b.badge, 'photos', b.badge_photos, 'invitation', b.code_invitation,
    'badge', public.badge_controle(b.badge),
    'alertes', (select coalesce(json_agg(json_build_object('id', a.id, 'texte', a.texte, 'photo', a.photo, 'cree_le', a.cree_le, 'lu_le', a.lu_le) order by a.cree_le desc), '[]'::json)
                  from (select * from public.alertes_voyageurs where client_id = b.client_id and bien_id = b.id order by cree_le desc limit 20) a));
end $$;
grant execute on function public.mon_badge(text) to authenticated;

create or replace function public.regler_badge(p_bien text, p_photos boolean) returns boolean language sql security definer set search_path to '' as $$
  update public.biens set badge_photos = coalesce(p_photos, false) where id = p_bien and client_id = auth.uid() returning badge_photos;
$$;
grant execute on function public.regler_badge(text, boolean) to authenticated;

-- Ancien appel de l'appli : le lien du badge (créé au besoin avec son code d'invitation).
drop function if exists public.lien_badge(text);
create function public.lien_badge(p_bien text) returns uuid language sql security definer set search_path to '' as $$
  select (public.mon_badge(p_bien)->>'code')::uuid;
$$;
grant execute on function public.lien_badge(text) to authenticated;

-- Code d'invitation d'un bien reconnu comme un code de parrainage (le propriétaire est le parrain).
create or replace function public.lier_parrain(p_filleul uuid, p_code text) returns text language plpgsql security definer set search_path to '' as $$
declare f public.profils; p public.profils; t text;
begin
  if coalesce(trim(p_code), '') = '' then return 'introuvable'; end if;
  select * into f from public.profils where id = p_filleul;
  select * into p from public.profils where code_parrainage = upper(trim(p_code));
  if p.id is null then
    select pr.* into p from public.profils pr join public.biens b on b.client_id = pr.id where b.code_invitation = upper(trim(p_code)) limit 1;
  end if;
  if p.id is null or f.id is null then return 'introuvable'; end if;
  if p.id = f.id then return 'soi_meme'; end if;
  if f.parrain_id is not null or exists (select 1 from public.parrainages where filleul_id = f.id) then return 'deja'; end if;
  t := case when 'cleaneur' = any (f.statuts) then (case when 'cleaneur' = any (p.statuts) then 'cleaneur' else 'client_cleaneur' end)
            when 'pro' = any (f.statuts) and 'pro' = any (p.statuts) and not ('particulier' = any (f.statuts)) then 'conciergerie'
            else 'client' end;
  update public.profils set parrain_id = p.id where id = f.id;
  insert into public.parrainages (filleul_id, parrain_id, type) values (f.id, p.id, t);
  return 'ok';
end $$;

-- Alertes des voyageurs : une photo et un mot, envoyés au propriétaire depuis le badge.
create table if not exists public.alertes_voyageurs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references auth.users(id) on delete cascade,
  bien_id text not null,
  texte text not null check (char_length(texte) between 3 and 600),
  photo text check (photo is null or char_length(photo) <= 200),
  cree_le timestamptz not null default now(),
  lu_le timestamptz);
create index if not exists alertes_voyageurs_bien on public.alertes_voyageurs (client_id, bien_id, cree_le desc);
alter table public.alertes_voyageurs enable row level security;
drop policy if exists "alertes : le propriétaire lit" on public.alertes_voyageurs;
create policy "alertes : le propriétaire lit" on public.alertes_voyageurs for select to authenticated using (client_id = (select auth.uid()));

create or replace function public.alerte_voyageur(p_code uuid, p_texte text, p_photo text default null) returns text language plpgsql security definer set search_path to '' as $$
declare b public.biens;
begin
  select * into b from public.biens where badge = p_code;
  if b.client_id is null then return 'introuvable'; end if;
  if char_length(trim(coalesce(p_texte, ''))) < 3 then return 'texte'; end if;
  if (select count(*) from public.alertes_voyageurs where client_id = b.client_id and bien_id = b.id and cree_le > now() - interval '1 hour') >= 3
     or (select count(*) from public.alertes_voyageurs where client_id = b.client_id and bien_id = b.id and cree_le > now() - interval '24 hours') >= 10 then
    return 'trop';
  end if;
  insert into public.alertes_voyageurs (client_id, bien_id, texte, photo)
  values (b.client_id, b.id, left(trim(p_texte), 600), case when p_photo like p_code::text || '/%' then left(p_photo, 200) end);
  perform public.notifier(b.client_id, 'client', 'alerte', 'important', 'Un voyageur vous signale un souci',
    coalesce(nullif(b.donnees->>'nom', ''), 'Votre logement') || ' : ' || left(trim(p_texte), 200), null);
  return 'ok';
end $$;
grant execute on function public.alerte_voyageur(uuid, text, text) to anon, authenticated;

create or replace function public.alerte_lue(p_id uuid) returns void language sql security definer set search_path to '' as $$
  update public.alertes_voyageurs set lu_le = coalesce(lu_le, now()) where id = p_id and client_id = auth.uid();
$$;
grant execute on function public.alerte_lue(uuid) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('alertes-voyageurs', 'alertes-voyageurs', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
drop policy if exists "alertes : le voyageur dépose" on storage.objects;
create policy "alertes : le voyageur dépose" on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'alertes-voyageurs' and exists (select 1 from public.biens b where b.badge::text = (storage.foldername(name))[1]));
drop policy if exists "alertes : le propriétaire lit" on storage.objects;
create policy "alertes : le propriétaire lit" on storage.objects for select to authenticated
  using (bucket_id = 'alertes-voyageurs' and exists (select 1 from public.biens b where b.badge::text = (storage.foldername(name))[1] and b.client_id = (select auth.uid())));

-- Biens qui ont déjà un badge : leur code d'invitation.
update public.biens set code_invitation = public.nouveau_code_invitation() where badge is not null and code_invitation is null;
