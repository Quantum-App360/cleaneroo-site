-- Espace « Hôtels et campings » (16 novembre 2026). Appliqué par Claude avec l'accord de l'utilisateur.
-- Statut et espace « hotellerie » (société + SIRET exigés, comme pro et entreprise), demandes de la partie « hotellerie ».
-- Protection contre le salariat déguisé : pour un même établissement, un Cleaneur ne voit plus ses missions s'il y travaille déjà
-- 4 jours différents à 6 jours ou moins de la date de la mission (même valeur que REGLES.JOURS_MAX_MEME_SITE).

alter table public.profils drop constraint if exists profils_espace_valide;
alter table public.profils drop constraint if exists profils_statuts_valides;
alter table public.profils add constraint profils_espace_valide check (espace = any (array['particulier', 'entreprise', 'pro', 'hotellerie', 'cleaneur']) and espace = any (statuts));
alter table public.profils add constraint profils_statuts_valides check (cardinality(statuts) between 1 and 5 and statuts <@ array['particulier', 'entreprise', 'pro', 'hotellerie', 'cleaneur']);
alter table public.demandes drop constraint if exists demandes_espace_check;
alter table public.demandes add constraint demandes_espace_check check (espace = any (array['personnel', 'conciergerie', 'professionnel', 'hotellerie']));

create or replace function public.ajouter_statut(s text) returns text language plpgsql security definer set search_path = '' as $$
declare p public.profils;
begin
  if s not in ('particulier', 'entreprise', 'pro', 'hotellerie', 'cleaneur') then return 'invalide'; end if;
  select * into p from public.profils where id = auth.uid();
  if not found then return 'invalide'; end if;
  if s in ('pro', 'entreprise', 'hotellerie') and (coalesce(p.societe, '') = '' or not public.siren_siret_valide(p.siret_societe)) then return 'societe'; end if;
  update public.profils set statuts = case when s = any (statuts) then statuts else statuts || s end,
    role = case when s = 'cleaneur' and role = 'client' then 'cleaneur' else role end, espace = s where id = auth.uid();
  return 'ok';
end $$;

create or replace function public.espace_recompense(p public.profils) returns text language sql stable set search_path = '' as $$
  select case when 'particulier' = any (p.statuts) then 'particulier'
    when 'pro' = any (p.statuts) or 'entreprise' = any (p.statuts) or 'hotellerie' = any (p.statuts) then 'pro' else 'cleaneur' end;
$$;

create or replace function public.nouveau_profil() returns trigger language plpgsql security definer set search_path = '' as $$
declare m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb); st text[]; soc text := left(coalesce(m->>'societe', ''), 120);
  sir text := regexp_replace(coalesce(m->>'siret_societe', ''), '[^0-9]', '', 'g'); societe_ok boolean;
begin
  if jsonb_typeof(m->'statuts') = 'array' then
    select coalesce(array_agg(distinct x), '{}') into st from jsonb_array_elements_text(m->'statuts') x where x in ('particulier', 'entreprise', 'pro', 'hotellerie', 'cleaneur');
  else st := array[case when m->>'role' = 'cleaneur' then 'cleaneur' when m->>'espace' = 'pro' then 'pro' else 'particulier' end]; end if;
  societe_ok := soc <> '' and public.siren_siret_valide(sir);
  if not societe_ok then st := array_remove(array_remove(array_remove(st, 'pro'), 'entreprise'), 'hotellerie'); end if;
  if cardinality(st) = 0 then st := '{particulier}'; end if;
  if not ('pro' = any (st) or 'entreprise' = any (st) or 'hotellerie' = any (st)) then soc := ''; sir := ''; end if;
  insert into public.profils (id, role, prenom, nom, statuts, espace, societe, siret_societe)
  values (new.id, case when 'cleaneur' = any (st) then 'cleaneur' else 'client' end, left(coalesce(m->>'prenom', ''), 80), left(coalesce(m->>'nom', ''), 80), st,
    case when 'cleaneur' = any (st) then 'cleaneur' when 'pro' = any (st) then 'pro' when 'hotellerie' = any (st) then 'hotellerie' when 'entreprise' = any (st) then 'entreprise' else 'particulier' end,
    nullif(soc, ''), sir) on conflict do nothing;
  if coalesce(m->>'code_parrain', '') <> '' then perform public.lier_parrain(new.id, m->>'code_parrain'); end if;
  return new;
end $$;

-- Jours déjà travaillés par le Cleaneur connecté pour le même établissement, à 6 jours ou moins de la mission (hors jour de la mission).
create or replace function public.limite_meme_site(d public.demandes) returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(d.espace, '') = 'hotellerie' and d.creneau is not null and d.client_id is not null and (
    select count(distinct (x.creneau at time zone 'Europe/Paris')::date) from public.demandes x
    where x.client_id = d.client_id and x.cleaneur_id = auth.uid() and x.statut <> 'ANNULEE' and x.creneau is not null
      and (x.creneau at time zone 'Europe/Paris')::date <> (d.creneau at time zone 'Europe/Paris')::date
      and abs((x.creneau at time zone 'Europe/Paris')::date - (d.creneau at time zone 'Europe/Paris')::date) <= 6) >= 4;
$$;

create or replace function public.mission_visible(d public.demandes) returns boolean language sql stable security definer set search_path = '' as $$
  select public.est_admin() or (not public.limite_meme_site(d) and (
    (public.favori_exclusif(d) and d.cleaneur_favori = auth.uid())
    or (not public.favori_exclusif(d) and (
      public.formule_effective(auth.uid()) = 'pro'
      or (coalesce(d.espace, 'personnel') = 'personnel'
          and (d.urgence or d.cree_le <= now() - make_interval(mins => 30 - public.avance_niveau(auth.uid()))))
      or (coalesce(d.espace, 'personnel') <> 'personnel' and coalesce((public.niveau_de(auth.uid())->>'niveau')::int, 0) >= 2)
      or exists (select 1 from public.invitations_pro i where i.statut = 'ACTIF' and i.cleaneur_id = auth.uid() and i.pro_id = d.client_id)
      or exists (select 1 from public.favoris f where f.client_id = d.client_id and f.cleaneur_id = auth.uid())))));
$$;
