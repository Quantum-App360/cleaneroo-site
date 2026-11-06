-- Base Supabase « cleaneroo » (Paris) : vrais comptes avant l'ouverture (décision de l'utilisateur, 6 novembre 2026).
-- Clients : compte, profil, demandes liées au compte. Cleaneurs : profil, documents, dossier envoyé à la vérification.
-- Aucune intervention avant le 1er janvier 2027 (Regles.DATE_PREMIERES_INTERVENTIONS / regles.js), même pour l'administration.
-- Appliqué le 6 novembre 2026 (accord de l'utilisateur), testé avec deux comptes de test ensuite supprimés. Sans effet sur les demandes et inscriptions existantes.

-- 1. Profil : informations du compte et dossier Cleaneur.
alter table public.profils add column if not exists code_postal text not null default '' check (code_postal = '' or code_postal ~ '^[0-9]{5}$');
alter table public.profils add column if not exists ville text not null default '' check (char_length(ville) <= 100);
alter table public.profils add column if not exists siret text not null default '' check (siret = '' or siret ~ '^[0-9]{14}$');
alter table public.profils add column if not exists prestations text[] not null default '{}' check (cardinality(prestations) <= 20);
alter table public.profils add column if not exists zone_km smallint not null default 15 check (zone_km between 1 and 100);
alter table public.profils add column if not exists dossier text not null default 'BROUILLON' check (dossier in ('BROUILLON', 'A_VERIFIER', 'VALIDE', 'REFUSE'));
alter table public.profils add column if not exists dossier_motif text not null default '' check (char_length(dossier_motif) <= 500);
alter table public.profils add column if not exists dossier_soumis_le timestamptz;
alter table public.profils add column if not exists valide_le timestamptz;

-- Chacun ne modifie que ses informations personnelles : jamais son rôle ni l'état de son dossier.
revoke update on public.profils from anon, authenticated;
grant update (prenom, nom, telephone, code_postal, ville, siret, prestations, zone_km) on public.profils to authenticated;

-- Rôle choisi à la création du compte (client ou Cleaneur ; jamais administrateur).
create or replace function public.nouveau_profil() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profils (id, role, prenom, nom) values (new.id,
    case when new.raw_user_meta_data->>'role' = 'cleaneur' then 'cleaneur' else 'client' end,
    left(coalesce(new.raw_user_meta_data->>'prenom', ''), 80), left(coalesce(new.raw_user_meta_data->>'nom', ''), 80))
  on conflict do nothing;
  return new;
end;
$$;

-- Un client peut ouvrir son espace Cleaneur avec le même compte.
create or replace function public.devenir_cleaneur() returns void
language sql security definer set search_path = '' as $$
  update public.profils set role = 'cleaneur' where id = auth.uid() and role = 'client';
$$;
revoke all on function public.devenir_cleaneur() from public;
grant execute on function public.devenir_cleaneur() to authenticated;

-- 2. Documents des Cleaneurs : une ligne par document déposé (photo ou PDF dans le stockage privé).
create table if not exists public.documents_cleaneur (
  id uuid primary key default gen_random_uuid(),
  cleaneur_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('identite', 'siret', 'rc_pro', 'urssaf', 'certibiocide')),
  chemin text not null check (char_length(chemin) <= 300),
  statut text not null default 'A_VERIFIER' check (statut in ('A_VERIFIER', 'ACCEPTE', 'REFUSE')),
  motif text not null default '' check (char_length(motif) <= 500),
  cree_le timestamptz not null default now()
);
alter table public.documents_cleaneur enable row level security;
create index if not exists documents_cleaneur_idx on public.documents_cleaneur (cleaneur_id, type);

create policy "document : déposer le sien" on public.documents_cleaneur for insert to authenticated
  with check (cleaneur_id = (select auth.uid()) and statut = 'A_VERIFIER' and motif = ''
    and (storage.foldername(chemin))[1] = (select auth.uid())::text);
create policy "document : lire les siens ou admin" on public.documents_cleaneur for select to authenticated
  using (cleaneur_id = (select auth.uid()) or (select public.est_admin()));
create policy "document : retirer le sien non vérifié" on public.documents_cleaneur for delete to authenticated
  using (cleaneur_id = (select auth.uid()) and statut <> 'ACCEPTE');

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documents-cleaneurs', 'documents-cleaneurs', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;
create policy "documents : déposer dans son dossier" on storage.objects for insert to authenticated
  with check (bucket_id = 'documents-cleaneurs' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "documents : lire les siens ou admin" on storage.objects for select to authenticated
  using (bucket_id = 'documents-cleaneurs' and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.est_admin())));
create policy "documents : retirer les siens" on storage.objects for delete to authenticated
  using (bucket_id = 'documents-cleaneurs' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- 3. Envoi du dossier à la vérification : profil complet et 4 documents obligatoires.
create or replace function public.soumettre_dossier() returns text
language plpgsql security definer set search_path = '' as $$
declare p public.profils;
begin
  select * into p from public.profils where id = auth.uid();
  if p.id is null or p.role not in ('cleaneur', 'admin') then return 'role'; end if;
  if p.prenom = '' or p.nom = '' or p.telephone = '' or p.code_postal = '' or p.siret = '' or cardinality(p.prestations) = 0 then return 'profil'; end if;
  if (select count(distinct type) from public.documents_cleaneur
      where cleaneur_id = p.id and statut <> 'REFUSE' and type in ('identite', 'siret', 'rc_pro', 'urssaf')) < 4 then return 'documents'; end if;
  update public.profils set dossier = 'A_VERIFIER', dossier_motif = '', dossier_soumis_le = now() where id = p.id and dossier <> 'VALIDE';
  return 'ok';
end;
$$;
revoke all on function public.soumettre_dossier() from public;
grant execute on function public.soumettre_dossier() to authenticated;

-- 4. Administration : liste des dossiers (avec l'e-mail du compte) et décision.
create or replace function public.dossiers_cleaneurs()
returns table (id uuid, email text, prenom text, nom text, telephone text, code_postal text, ville text, siret text,
  prestations text[], zone_km smallint, dossier text, dossier_motif text, dossier_soumis_le timestamptz, valide_le timestamptz, cree_le timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.est_admin() then raise exception 'réservé à l''administration'; end if;
  return query select p.id, u.email::text, p.prenom, p.nom, p.telephone, p.code_postal, p.ville, p.siret, p.prestations, p.zone_km,
    p.dossier, p.dossier_motif, p.dossier_soumis_le, p.valide_le, p.cree_le
    from public.profils p join auth.users u on u.id = p.id where p.role = 'cleaneur'
    order by (p.dossier = 'A_VERIFIER') desc, p.dossier_soumis_le nulls last, p.cree_le desc;
end;
$$;
revoke all on function public.dossiers_cleaneurs() from public;
grant execute on function public.dossiers_cleaneurs() to authenticated;

create or replace function public.decider_dossier_cleaneur(p_id uuid, p_valide boolean, p_motif text default '')
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.est_admin() then raise exception 'réservé à l''administration'; end if;
  update public.profils set dossier = case when p_valide then 'VALIDE' else 'REFUSE' end,
    dossier_motif = case when p_valide then '' else left(coalesce(p_motif, ''), 500) end,
    valide_le = case when p_valide then coalesce(valide_le, now()) else null end
    where id = p_id and role = 'cleaneur';
  if p_valide then update public.documents_cleaneur set statut = 'ACCEPTE', motif = '' where cleaneur_id = p_id and statut = 'A_VERIFIER'; end if;
end;
$$;
revoke all on function public.decider_dossier_cleaneur(uuid, boolean, text) from public;
grant execute on function public.decider_dossier_cleaneur(uuid, boolean, text) to authenticated;

create or replace function public.decider_document(p_id uuid, p_accepte boolean, p_motif text default '')
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.est_admin() then raise exception 'réservé à l''administration'; end if;
  update public.documents_cleaneur set statut = case when p_accepte then 'ACCEPTE' else 'REFUSE' end,
    motif = case when p_accepte then '' else left(coalesce(p_motif, ''), 500) end where id = p_id;
end;
$$;
revoke all on function public.decider_document(uuid, boolean, text) from public;
grant execute on function public.decider_document(uuid, boolean, text) to authenticated;

-- 5. Offre de lancement : places restantes = 500 moins les Cleaneurs validés (pré-inscriptions et comptes, une fois par e-mail).
--    501 places au total : une place est prise par le compte de test du fondateur, il reste donc bien 500 places réelles.
create or replace function public.places_offre_restantes()
returns integer language sql stable security definer set search_path = '' as $$
  select greatest(0, least(500, 501 - (select count(*) from (
    select lower(i.email) from public.inscriptions i where i.type = 'cleaneur' and i.valide_le is not null
    union
    select lower(u.email) from public.profils p join auth.users u on u.id = p.id where p.role = 'cleaneur' and p.dossier = 'VALIDE'
  ) v)))::integer;
$$;

-- 6. Aucune intervention avant le 1er janvier 2027 (heure de Paris), quelle que soit la personne qui enregistre la demande.
alter table public.demandes drop constraint if exists demandes_ouverture_check;
alter table public.demandes add constraint demandes_ouverture_check
  check (creneau is null or creneau >= timestamptz '2027-01-01 00:00:00 Europe/Paris') not valid;

-- 7. « Mes biens » : adresses déjà renseignées par un client (logement, bureau…), retrouvées sur tous ses appareils et dans l'appli.
--    donnees = même contenu que l'adresse enregistrée par le parcours de réservation (type, surface, pièces, adresse, accueil ; jamais le code d'accès).
create table if not exists public.biens (
  id text not null check (char_length(id) between 1 and 40),
  client_id uuid not null references auth.users(id) on delete cascade,
  donnees jsonb not null default '{}'::jsonb check (pg_column_size(donnees) < 4000 and not (donnees ? 'code')),
  maj_le timestamptz not null default now(),
  primary key (client_id, id)
);
alter table public.biens enable row level security;
create policy "bien : le client gère les siens" on public.biens for all to authenticated
  using (client_id = (select auth.uid())) with check (client_id = (select auth.uid()));
create policy "bien : admin lit" on public.biens for select to authenticated using ((select public.est_admin()));

-- 8. (appliqué ensuite) L'ancienne règle « modifier le sien (sans changer de rôle) » relisait profils : récursion infinie.
--    Le rôle et le dossier sont protégés par les droits par colonne ci-dessus.
drop policy if exists "profil : modifier le sien (sans changer de rôle)" on public.profils;
create policy "profil : modifier le sien" on public.profils for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- 9. (appliqué ensuite) Fonctions du compte et de l'administration fermées aux visiteurs non connectés.
revoke execute on function public.devenir_cleaneur() from anon;
revoke execute on function public.soumettre_dossier() from anon;
revoke execute on function public.dossiers_cleaneurs() from anon;
revoke execute on function public.decider_dossier_cleaneur(uuid, boolean, text) from anon;
revoke execute on function public.decider_document(uuid, boolean, text) from anon;
revoke execute on function public.valider_dossier_cleaneur(uuid, boolean) from anon;
