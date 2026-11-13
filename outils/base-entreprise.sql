-- Espaces distincts (13 novembre 2026) : le statut « pro » devient l'espace Conciergerie (SCI, conciergerie, plusieurs biens) ;
-- nouveau statut « entreprise » : client professionnel qui réserve le ménage de ses bureaux, commerces ou cabinets.
-- Les deux demandent une société (raison sociale + SIRET/SIREN), partagée entre eux (colonnes societe / siret_societe).
-- Récompenses en euros : un compte Entreprise utilise la cagnotte « pro » (prestations professionnelles).

alter table public.profils drop constraint if exists profils_statuts_valides;
alter table public.profils add constraint profils_statuts_valides
  check (cardinality(statuts) between 1 and 4 and statuts <@ array['particulier', 'entreprise', 'pro', 'cleaneur']);
alter table public.profils drop constraint if exists profils_espace_valide;
alter table public.profils add constraint profils_espace_valide
  check (espace in ('particulier', 'entreprise', 'pro', 'cleaneur') and espace = any (statuts));

-- L'administrateur a tous les espaces.
update public.profils set statuts = '{particulier,entreprise,pro,cleaneur}' where role = 'admin';

create or replace function public.espace_recompense(p public.profils) returns text
language sql stable set search_path = '' as $$
  select case when 'particulier' = any (p.statuts) then 'particulier'
              when 'pro' = any (p.statuts) or 'entreprise' = any (p.statuts) then 'pro' else 'cleaneur' end;
$$;

create or replace function public.ajouter_statut(s text) returns text
language plpgsql security definer set search_path = '' as $$
declare p public.profils;
begin
  if s not in ('particulier', 'entreprise', 'pro', 'cleaneur') then return 'invalide'; end if;
  select * into p from public.profils where id = auth.uid();
  if not found then return 'invalide'; end if;
  if s in ('pro', 'entreprise') and (coalesce(p.societe, '') = '' or not public.siren_siret_valide(p.siret_societe)) then return 'societe'; end if;
  update public.profils set
    statuts = case when s = any (statuts) then statuts else statuts || s end,
    role = case when s = 'cleaneur' and role = 'client' then 'cleaneur' else role end,
    espace = s
  where id = auth.uid();
  return 'ok';
end $$;
revoke all on function public.ajouter_statut(text) from public, anon;
grant execute on function public.ajouter_statut(text) to authenticated;

create or replace function public.nouveau_profil() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  st text[];
  soc text := left(coalesce(m->>'societe', ''), 120);
  sir text := regexp_replace(coalesce(m->>'siret_societe', ''), '[^0-9]', '', 'g');
  societe_ok boolean;
begin
  if jsonb_typeof(m->'statuts') = 'array' then
    select coalesce(array_agg(distinct x), '{}') into st from jsonb_array_elements_text(m->'statuts') x
      where x in ('particulier', 'entreprise', 'pro', 'cleaneur');
  else
    st := array[case when m->>'role' = 'cleaneur' then 'cleaneur' when m->>'espace' = 'pro' then 'pro' else 'particulier' end];
  end if;
  societe_ok := soc <> '' and public.siren_siret_valide(sir);
  if not societe_ok then st := array_remove(array_remove(st, 'pro'), 'entreprise'); end if;
  if cardinality(st) = 0 then st := '{particulier}'; end if;
  if not ('pro' = any (st) or 'entreprise' = any (st)) then soc := ''; sir := ''; end if;
  insert into public.profils (id, role, prenom, nom, statuts, espace, societe, siret_societe) values (new.id,
    case when 'cleaneur' = any (st) then 'cleaneur' else 'client' end,
    left(coalesce(m->>'prenom', ''), 80), left(coalesce(m->>'nom', ''), 80), st,
    case when 'cleaneur' = any (st) then 'cleaneur' when 'pro' = any (st) then 'pro' when 'entreprise' = any (st) then 'entreprise' else 'particulier' end,
    nullif(soc, ''), sir)
  on conflict do nothing;
  if coalesce(m->>'code_parrain', '') <> '' then perform public.lier_parrain(new.id, m->>'code_parrain'); end if;
  return new;
end $$;
