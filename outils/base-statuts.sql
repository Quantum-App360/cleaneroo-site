-- Statuts cumulables (7 novembre 2026) : à l'inscription, on coche un ou plusieurs statuts.
--   particulier → espace Particulier ; pro (SCI, conciergerie, multi-biens) → espace Pro ; cleaneur → espace Cleaneur.
-- Chaque statut n'ouvre que son espace ; « espace » = l'espace ouvert, toujours parmi les statuts (bouton « Changer d'espace »).
-- Statut pro : raison sociale + SIRET (14 chiffres) ou SIREN (9 chiffres) obligatoires, séparés du SIRET de Cleaneur.
-- L'administrateur a les trois statuts.

-- Contrôle de clé (algorithme de Luhn) d'un SIREN ou d'un SIRET.
create or replace function public.siren_siret_valide(n text) returns boolean
language plpgsql immutable set search_path = '' as $$
declare s int := 0; d int; i int; l int;
begin
  if n is null or n !~ '^([0-9]{9}|[0-9]{14})$' then return false; end if;
  l := length(n);
  for i in 1..l loop
    d := substr(n, l - i + 1, 1)::int;
    if i % 2 = 0 then d := d * 2; if d > 9 then d := d - 9; end if; end if;
    s := s + d;
  end loop;
  return s % 10 = 0;
end $$;

alter table public.profils add column if not exists statuts text[] not null default '{particulier}';
alter table public.profils add column if not exists siret_societe text not null default '';

update public.profils set statuts = case
  when role = 'admin' then '{particulier,pro,cleaneur}'::text[]
  when role = 'cleaneur' then '{cleaneur}'::text[]
  when espace = 'pro' then '{pro}'::text[]
  else '{particulier}'::text[] end;
update public.profils set espace = 'cleaneur' where role = 'cleaneur';

alter table public.profils drop constraint if exists profils_espace_valide;
alter table public.profils add constraint profils_statuts_valides
  check (cardinality(statuts) between 1 and 3 and statuts <@ array['particulier', 'pro', 'cleaneur']);
alter table public.profils add constraint profils_espace_valide
  check (espace in ('particulier', 'pro', 'cleaneur') and espace = any (statuts));
alter table public.profils add constraint profils_siret_societe_check
  check (siret_societe = '' or public.siren_siret_valide(siret_societe));

-- Le compte peut choisir son espace (parmi ses statuts : contrôlé ci-dessus) et renseigner sa société ; jamais ses statuts directement.
grant update (siret_societe) on public.profils to authenticated;

-- Création du profil à l'inscription : statuts cochés (métadonnées), sinon ancien format (role / espace).
create or replace function public.nouveau_profil() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  st text[];
  soc text := left(coalesce(m->>'societe', ''), 120);
  sir text := regexp_replace(coalesce(m->>'siret_societe', ''), '[^0-9]', '', 'g');
begin
  if jsonb_typeof(m->'statuts') = 'array' then
    select coalesce(array_agg(distinct x), '{}') into st from jsonb_array_elements_text(m->'statuts') x where x in ('particulier', 'pro', 'cleaneur');
  else
    st := array[case when m->>'role' = 'cleaneur' then 'cleaneur' when m->>'espace' = 'pro' then 'pro' else 'particulier' end];
  end if;
  -- Statut pro sans société valable : refusé (l'écran d'inscription l'exige déjà).
  if 'pro' = any (st) and (soc = '' or not public.siren_siret_valide(sir)) then st := array_remove(st, 'pro'); soc := ''; sir := ''; end if;
  if cardinality(st) = 0 then st := '{particulier}'; end if;
  if not ('pro' = any (st)) then soc := ''; sir := ''; end if;
  insert into public.profils (id, role, prenom, nom, statuts, espace, societe, siret_societe) values (new.id,
    case when 'cleaneur' = any (st) then 'cleaneur' else 'client' end,
    left(coalesce(m->>'prenom', ''), 80), left(coalesce(m->>'nom', ''), 80), st,
    case when 'cleaneur' = any (st) then 'cleaneur' when 'pro' = any (st) then 'pro' else 'particulier' end,
    nullif(soc, ''), sir)
  on conflict do nothing;
  return new;
end $$;

-- Ajouter un statut plus tard (ex. un Cleaneur qui veut aussi réserver pour lui, un particulier qui devient Cleaneur).
-- Réponses : ok, societe (raison sociale ou SIRET/SIREN manquant ou faux), invalide.
create or replace function public.ajouter_statut(s text) returns text
language plpgsql security definer set search_path = '' as $$
declare p public.profils;
begin
  if s not in ('particulier', 'pro', 'cleaneur') then return 'invalide'; end if;
  select * into p from public.profils where id = auth.uid();
  if not found then return 'invalide'; end if;
  if s = 'pro' and (coalesce(p.societe, '') = '' or not public.siren_siret_valide(p.siret_societe)) then return 'societe'; end if;
  update public.profils set
    statuts = case when s = any (statuts) then statuts else statuts || s end,
    role = case when s = 'cleaneur' and role = 'client' then 'cleaneur' else role end,
    espace = s
  where id = auth.uid();
  return 'ok';
end $$;
revoke all on function public.ajouter_statut(text) from public, anon;
grant execute on function public.ajouter_statut(text) to authenticated;

-- « Devenir Cleaneur » (ancien bouton) : même chose que ajouter_statut('cleaneur').
create or replace function public.devenir_cleaneur() returns void
language sql security definer set search_path = '' as $$
  select public.ajouter_statut('cleaneur');
$$;

-- Temps réel : « Mes demandes » se met à jour toute seule (chaque compte ne reçoit que ses demandes, règle « lire les siennes ou admin »).
alter publication supabase_realtime add table public.demandes;
