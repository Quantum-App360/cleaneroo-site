-- Parrainage et cagnottes (7 novembre 2026, montants validés par l'utilisateur).
--   Cagnotte Cleaneroo par espace (particulier, pro, cleaneur) : crédit d'achat NON retirable (sauf les primes des Cleaneurs,
--   versées avec leurs gains), valable 12 mois.
--   Client → client : le filleul a 10 € de remise sur sa 1re prestation (à partir de 40 €) ; le parrain reçoit 10 € quand cette
--   prestation est terminée.
--   Conciergerie → conciergerie : 1 mois d'abonnement offert à chacun, quand la 1re prestation du filleul est terminée.
--   Cleaneur → Cleaneur : 20 € de prime au parrain après la 3e mission terminée du filleul.
--   Client → Cleaneur : 10 € dans la cagnotte du parrain après la 3e mission terminée du filleul.
--   Anti-abus : récompense seulement après prestation terminée ; 10 filleuls récompensés par an au plus ; même téléphone ou même
--   adresse que le parrain : refusé ; code utilisable à l'inscription ou dans les 30 jours, avant toute demande.
--   Les remises sont prises sur la marge de Cleaneroo : le Cleaneur est payé sur le prix plein (estimation_c inchangée).
--   Valeurs recopiées de Regles.kt / regles.js (PARRAINAGE_*).

alter table public.profils add column if not exists code_parrainage text unique;
alter table public.profils add column if not exists parrain_id uuid references public.profils (id) on delete set null;
alter table public.profils add column if not exists mois_abonnement_offerts smallint not null default 0;
alter table public.inscriptions add column if not exists code_parrain text check (char_length(code_parrain) <= 20);
alter table public.demandes add column if not exists remise_parrainage_c integer not null default 0 check (remise_parrainage_c >= 0);
alter table public.demandes add column if not exists cagnotte_c integer not null default 0 check (cagnotte_c >= 0);

create table if not exists public.parrainages (
  filleul_id uuid primary key references public.profils (id) on delete cascade,
  parrain_id uuid not null references public.profils (id) on delete cascade,
  type text not null check (type in ('client', 'conciergerie', 'cleaneur', 'client_cleaneur')),
  statut text not null default 'en_attente' check (statut in ('en_attente', 'recompense', 'refuse', 'plafond')),
  cree_le timestamptz not null default now(),
  recompense_le timestamptz
);
create index if not exists parrainages_parrain on public.parrainages (parrain_id);
alter table public.parrainages enable row level security;
drop policy if exists "parrainage : lire les siens ou admin" on public.parrainages;
create policy "parrainage : lire les siens ou admin" on public.parrainages for select
  using (parrain_id = (select auth.uid()) or filleul_id = (select auth.uid()) or (select public.est_admin()));

create table if not exists public.cagnotte (
  id bigserial primary key,
  profil_id uuid not null references public.profils (id) on delete cascade,
  espace text not null check (espace in ('particulier', 'pro', 'cleaneur')),
  montant_c integer not null,
  motif text not null,
  reference text,
  cree_le timestamptz not null default now(),
  expire_le timestamptz
);
create index if not exists cagnotte_profil on public.cagnotte (profil_id);
alter table public.cagnotte enable row level security;
drop policy if exists "cagnotte : lire la sienne ou admin" on public.cagnotte;
create policy "cagnotte : lire la sienne ou admin" on public.cagnotte for select
  using (profil_id = (select auth.uid()) or (select public.est_admin()));

-- Code de parrainage : 4 lettres du prénom + 4 caractères (ex. MICH-7K3Q).
create or replace function public.nouveau_code_parrainage(p_prenom text) returns text
language plpgsql volatile set search_path = '' as $$
declare base text := left(upper(regexp_replace(translate(coalesce(p_prenom, ''), 'àâäéèêëîïôöùûüçÀÂÄÉÈÊËÎÏÔÖÙÛÜÇ', 'aaaeeeeiioouuucAAAEEEEIIOOUUUC'), '[^A-Za-z]', '', 'g')), 4);
  c text;
begin
  if base = '' then base := 'CLNO'; end if;
  loop
    c := base || '-' || (select string_agg(substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 1 + floor(random() * 31)::int, 1), '') from generate_series(1, 4));
    exit when not exists (select 1 from public.profils where code_parrainage = c);
  end loop;
  return c;
end $$;
update public.profils set code_parrainage = public.nouveau_code_parrainage(prenom) where code_parrainage is null;

create or replace function public.profil_code_parrainage() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.code_parrainage is null then new.code_parrainage := public.nouveau_code_parrainage(new.prenom); end if;
  return new;
end $$;
drop trigger if exists profils_code_parrainage on public.profils;
create trigger profils_code_parrainage before insert on public.profils for each row execute function public.profil_code_parrainage();

-- Espace qui reçoit une récompense en euros : particulier, sinon pro, sinon cleaneur.
create or replace function public.espace_recompense(p public.profils) returns text
language sql stable set search_path = '' as $$
  select case when 'particulier' = any (p.statuts) then 'particulier' when 'pro' = any (p.statuts) then 'pro' else 'cleaneur' end;
$$;

-- Rattache un filleul à son parrain (type selon les statuts). Renvoie ok, introuvable, soi_meme, deja.
create or replace function public.lier_parrain(p_filleul uuid, p_code text) returns text
language plpgsql security definer set search_path = '' as $$
declare f public.profils; p public.profils; t text;
begin
  if coalesce(trim(p_code), '') = '' then return 'introuvable'; end if;
  select * into f from public.profils where id = p_filleul;
  select * into p from public.profils where code_parrainage = upper(trim(p_code));
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
revoke all on function public.lier_parrain(uuid, text) from public, anon, authenticated;

-- Code saisi après l'inscription : dans les 30 jours, avant toute demande. Renvoie ok, introuvable, soi_meme, deja, trop_tard.
create or replace function public.utiliser_code_parrainage(p_code text) returns text
language plpgsql security definer set search_path = '' as $$
declare f public.profils;
begin
  select * into f from public.profils where id = auth.uid();
  if f.id is null then return 'introuvable'; end if;
  if f.cree_le < now() - interval '30 days' or exists (select 1 from public.demandes where client_id = f.id) then return 'trop_tard'; end if;
  return public.lier_parrain(f.id, p_code);
end $$;
revoke all on function public.utiliser_code_parrainage(text) from public, anon;
grant execute on function public.utiliser_code_parrainage(text) to authenticated;

-- Solde d'une cagnotte (crédits non expirés moins dépenses), jamais négatif.
create or replace function public.solde_cagnotte(p_id uuid, p_espace text) returns integer
language sql stable security definer set search_path = '' as $$
  select greatest(0, coalesce(sum(montant_c) filter (where montant_c < 0 or expire_le is null or expire_le > now()), 0))::int
  from public.cagnotte where profil_id = p_id and espace = p_espace;
$$;
revoke all on function public.solde_cagnotte(uuid, text) from public, anon, authenticated;

-- Remise de bienvenue encore disponible pour ce filleul (10 €), sinon 0.
create or replace function public.remise_bienvenue_c(p_id uuid) returns integer
language sql stable security definer set search_path = '' as $$
  select case when exists (select 1 from public.parrainages pa where pa.filleul_id = p_id and pa.type = 'client' and pa.statut = 'en_attente')
    and not exists (select 1 from public.demandes d where d.client_id = p_id and d.remise_parrainage_c > 0 and d.statut <> 'ANNULEE')
    then 1000 else 0 end;
$$;
revoke all on function public.remise_bienvenue_c(uuid) from public, anon, authenticated;

-- Dépôt d'une demande : la base recalcule la remise et la cagnotte utilisable (rien n'est cru sur parole).
create or replace function public.demande_remises() returns trigger
language plpgsql security definer set search_path = '' as $$
declare esp text := case when new.espace = 'personnel' then 'particulier' else 'pro' end;
begin
  if new.client_id is null or new.sur_devis then new.remise_parrainage_c := 0; new.cagnotte_c := 0; return new; end if;
  new.remise_parrainage_c := case when new.remise_parrainage_c > 0 and new.estimation_c >= 4000 then public.remise_bienvenue_c(new.client_id) else 0 end;
  new.cagnotte_c := least(new.cagnotte_c, public.solde_cagnotte(new.client_id, esp), greatest(0, new.estimation_c - new.remise_parrainage_c));
  if new.espace = 'personnel' then
    new.credit_impot_c := least(new.credit_impot_c, greatest(0, new.estimation_c - new.remise_parrainage_c - new.cagnotte_c) / 2);
  end if;
  return new;
end $$;
drop trigger if exists demandes_remises on public.demandes;
create trigger demandes_remises before insert on public.demandes for each row execute function public.demande_remises();

create or replace function public.demande_debit_cagnotte() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.cagnotte_c > 0 then
    insert into public.cagnotte (profil_id, espace, montant_c, motif, reference)
    values (new.client_id, case when new.espace = 'personnel' then 'particulier' else 'pro' end, -new.cagnotte_c, 'utilisation', new.reference);
  end if;
  return new;
end $$;
drop trigger if exists demandes_debit_cagnotte on public.demandes;
create trigger demandes_debit_cagnotte after insert on public.demandes for each row execute function public.demande_debit_cagnotte();

-- Récompense d'un parrainage dont la condition est remplie (appelée à chaque prestation terminée).
create or replace function public.recompenser_parrainage(p_filleul uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare pa public.parrainages; p public.profils; f public.profils; n int;
begin
  select * into pa from public.parrainages where filleul_id = p_filleul and statut = 'en_attente' for update;
  if pa.filleul_id is null then return; end if;
  select * into p from public.profils where id = pa.parrain_id;
  select * into f from public.profils where id = pa.filleul_id;
  if pa.type in ('cleaneur', 'client_cleaneur') then
    select count(*) into n from public.demandes where cleaneur_id = p_filleul and statut = 'TERMINEE';
    if n < 3 then return; end if;
  elsif not exists (select 1 from public.demandes where client_id = p_filleul and statut = 'TERMINEE') then return;
  end if;
  -- Anti-abus : même téléphone, même adresse d'intervention, plafond annuel.
  if (coalesce(regexp_replace(p.telephone, '\D', '', 'g'), '') <> '' and regexp_replace(p.telephone, '\D', '', 'g') = regexp_replace(coalesce(f.telephone, ''), '\D', '', 'g'))
     or exists (select 1 from public.demandes a join public.demandes b on lower(trim(a.rue)) = lower(trim(b.rue)) and a.code_postal = b.code_postal
                where a.client_id = p.id and b.client_id = f.id) then
    update public.parrainages set statut = 'refuse' where filleul_id = p_filleul; return;
  end if;
  if (select count(*) from public.parrainages where parrain_id = p.id and statut = 'recompense' and recompense_le > now() - interval '365 days') >= 10 then
    update public.parrainages set statut = 'plafond' where filleul_id = p_filleul; return;
  end if;
  if pa.type = 'conciergerie' then
    update public.profils set mois_abonnement_offerts = mois_abonnement_offerts + 1 where id in (p.id, f.id);
  elsif pa.type = 'cleaneur' then
    insert into public.cagnotte (profil_id, espace, montant_c, motif) values (p.id, 'cleaneur', 2000, 'prime_parrainage');
  else
    insert into public.cagnotte (profil_id, espace, montant_c, motif, expire_le) values (p.id, public.espace_recompense(p), 1000, 'parrainage', now() + interval '12 months');
  end if;
  update public.parrainages set statut = 'recompense', recompense_le = now() where filleul_id = p_filleul;
end $$;
revoke all on function public.recompenser_parrainage(uuid) from public, anon, authenticated;

-- Fin d'une demande : prestation terminée → récompenses ; annulée → cagnotte rendue.
create or replace function public.demande_fin_parrainage() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.statut = 'TERMINEE' and old.statut <> 'TERMINEE' then
    if new.client_id is not null then perform public.recompenser_parrainage(new.client_id); end if;
    if new.cleaneur_id is not null then perform public.recompenser_parrainage(new.cleaneur_id); end if;
  elsif new.statut = 'ANNULEE' and old.statut <> 'ANNULEE' and new.cagnotte_c > 0 and new.client_id is not null then
    insert into public.cagnotte (profil_id, espace, montant_c, motif, reference, expire_le)
    values (new.client_id, case when new.espace = 'personnel' then 'particulier' else 'pro' end, new.cagnotte_c, 'remboursement', new.reference, now() + interval '12 months');
  end if;
  return new;
end $$;
drop trigger if exists demandes_fin_parrainage on public.demandes;
create trigger demandes_fin_parrainage after update of statut on public.demandes for each row execute function public.demande_fin_parrainage();

-- Tout pour l'écran « Parrainage » du compte connecté.
create or replace function public.mon_parrainage() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'code', p.code_parrainage,
    'soldes', jsonb_build_object('particulier', public.solde_cagnotte(p.id, 'particulier'), 'pro', public.solde_cagnotte(p.id, 'pro'),
                                 'cleaneur', public.solde_cagnotte(p.id, 'cleaneur')),
    'mois_offerts', p.mois_abonnement_offerts,
    'remise_bienvenue_c', public.remise_bienvenue_c(p.id),
    'a_un_parrain', p.parrain_id is not null,
    'peut_saisir_code', p.parrain_id is null and p.cree_le >= now() - interval '30 days' and not exists (select 1 from public.demandes where client_id = p.id),
    'filleuls', coalesce((select jsonb_agg(jsonb_build_object('prenom', f.prenom, 'type', pa.type, 'statut', pa.statut, 'cree_le', pa.cree_le) order by pa.cree_le desc)
                          from public.parrainages pa join public.profils f on f.id = pa.filleul_id where pa.parrain_id = p.id), '[]'::jsonb),
    'mouvements', coalesce((select jsonb_agg(jsonb_build_object('espace', c.espace, 'montant_c', c.montant_c, 'motif', c.motif, 'cree_le', c.cree_le, 'expire_le', c.expire_le) order by c.cree_le desc)
                            from (select * from public.cagnotte where profil_id = p.id order by cree_le desc limit 30) c), '[]'::jsonb))
  from public.profils p where p.id = auth.uid();
$$;
revoke all on function public.mon_parrainage() from public, anon;
grant execute on function public.mon_parrainage() to authenticated;

-- Inscription : le code de parrainage éventuel (métadonnée code_parrain) est rattaché tout de suite.
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
  if 'pro' = any (st) and (soc = '' or not public.siren_siret_valide(sir)) then st := array_remove(st, 'pro'); soc := ''; sir := ''; end if;
  if cardinality(st) = 0 then st := '{particulier}'; end if;
  if not ('pro' = any (st)) then soc := ''; sir := ''; end if;
  insert into public.profils (id, role, prenom, nom, statuts, espace, societe, siret_societe) values (new.id,
    case when 'cleaneur' = any (st) then 'cleaneur' else 'client' end,
    left(coalesce(m->>'prenom', ''), 80), left(coalesce(m->>'nom', ''), 80), st,
    case when 'cleaneur' = any (st) then 'cleaneur' when 'pro' = any (st) then 'pro' else 'particulier' end,
    nullif(soc, ''), sir)
  on conflict do nothing;
  if coalesce(m->>'code_parrain', '') <> '' then perform public.lier_parrain(new.id, m->>'code_parrain'); end if;
  return new;
end $$;
