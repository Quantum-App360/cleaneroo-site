-- Formations et qualifications des Cleaneurs (reprise de l'appli iPhone de Vincent, 12 novembre 2026).
-- 20 modules : 14 se valident par un quiz (bonnes réponses gardées ici, jamais envoyées au téléphone),
-- 6 « sur attestation » (document déposé puis accepté par l'administration).
-- Une mission n'est proposée et ne peut être prise que par un Cleaneur qualifié pour sa prestation.
-- Textes : outils/formations/*.json -> assets/data/formations.json (site) et app/src/main/assets/formations.json (appli).
-- Bonnes réponses : outils/base-formations-reponses.sql (fabriqué par outils/formations/generer.py).

create table if not exists public.quiz_reponses (
  module text not null, num smallint not null, bonne smallint not null, primary key (module, num));
alter table public.quiz_reponses enable row level security;   -- aucune règle : lisible seulement par les fonctions
revoke all on public.quiz_reponses from anon, authenticated;

create table if not exists public.qualifications (
  cleaneur_id uuid not null references auth.users(id) on delete cascade,
  module text not null check (char_length(module) <= 40),
  essais integer not null default 0,
  valide_le timestamptz,
  dernier_essai_le timestamptz not null default now(),
  primary key (cleaneur_id, module));
alter table public.qualifications enable row level security;
drop policy if exists "qualification : lire les siennes ou admin" on public.qualifications;
create policy "qualification : lire les siennes ou admin" on public.qualifications for select to authenticated
  using (cleaneur_id = (select auth.uid()) or (select public.est_admin()));

-- Attestations des formations réglementées : nouveaux types de documents.
alter table public.documents_cleaneur drop constraint if exists documents_cleaneur_type_check;
alter table public.documents_cleaneur add constraint documents_cleaneur_type_check check (type in
  ('identite', 'siret', 'rc_pro', 'urssaf', 'certibiocide',
   'formation_hauteur', 'formation_haccp', 'formation_biocides', 'formation_electrique', 'formation_specialise'));

-- Module « sur attestation » -> type de document (copie de DOC dans generer.py).
create or replace function public.document_formation(p_module text) returns text language sql immutable set search_path to '' as $$
  select case p_module when 'hauteur' then 'formation_hauteur' when 'haccp' then 'formation_haccp'
    when 'biocides' then 'formation_biocides' when 'nuisibles' then 'certibiocide'
    when 'electrique' then 'formation_electrique' when 'specialise' then 'formation_specialise' end;
$$;

-- Qualifications exigées par prestation (copie de qualificationsRequises dans regles.js / Regles.kt).
create or replace function public.qualifs_requises(p_rubrique text, p_type_lieu text) returns text[] language sql immutable set search_path to '' as $$
  select array['socle'] || case p_rubrique
    when 'home' then array['domicile'] when 'rental' then array['domicile', 'location'] when 'moving' then array['domicile']
    when 'car' then array['auto'] when 'textiles' then array['textiles'] when 'construction' then array['remise-etat']
    when 'kitchen' then case when coalesce(p_type_lieu, 'particulier') in ('', 'particulier') then array['domicile'] else array['cuisine-pro', 'haccp'] end
    when 'office' then case when p_type_lieu = 'medical' then array['locaux-pro', 'bionettoyage'] else array['locaux-pro'] end
    when 'commerce' then array['locaux-pro'] when 'communal' then array['locaux-pro']
    when 'windows' then array['vitres'] when 'outdoor' then array['exterieurs'] when 'event' then array['evenementiel']
    when 'special' then case when p_type_lieu in ('cafards', 'punaises', 'rats', 'guepes') then array['nuisibles'] else array['specialise'] end
    else array[]::text[] end;
$$;

-- Modules validés d'un Cleaneur : quiz réussis + attestations acceptées.
create or replace function public.modules_valides(p_cleaneur uuid) returns text[] language sql stable security definer set search_path to '' as $$
  select coalesce(array_agg(distinct m), '{}') from (
    select q.module m from public.qualifications q where q.cleaneur_id = p_cleaneur and q.valide_le is not null
    union
    select x.m from unnest(array['hauteur', 'haccp', 'biocides', 'nuisibles', 'electrique', 'specialise']) x(m)
     where exists (select 1 from public.documents_cleaneur d where d.cleaneur_id = p_cleaneur
                    and d.type = public.document_formation(x.m) and d.statut = 'ACCEPTE')) s;
$$;

-- Le Cleaneur connecté est-il qualifié pour cette demande ?
create or replace function public.qualifie(d public.demandes) returns boolean language sql stable security definer set search_path to '' as $$
  select public.est_admin() or public.qualifs_requises(d.rubrique_id, d.details->>'typeLieuId') <@ public.modules_valides(auth.uid());
$$;

-- Mes formations : statut de chaque module touché (VALIDEE, A_VERIFIER, REFUSEE, ECHOUEE) et nombre d'essais.
create or replace function public.mes_formations() returns table(module text, statut text, essais integer) language sql stable security definer set search_path to '' as $$
  select q.module, case when q.valide_le is not null then 'VALIDEE' else 'ECHOUEE' end, q.essais
    from public.qualifications q where q.cleaneur_id = auth.uid()
  union all
  select x.m, case d.statut when 'ACCEPTE' then 'VALIDEE' when 'A_VERIFIER' then 'A_VERIFIER' else 'REFUSEE' end, 0
    from unnest(array['hauteur', 'haccp', 'biocides', 'nuisibles', 'electrique', 'specialise']) x(m)
    cross join lateral (select dc.statut from public.documents_cleaneur dc where dc.cleaneur_id = auth.uid()
                         and dc.type = public.document_formation(x.m)
                         order by (dc.statut = 'ACCEPTE') desc, dc.cree_le desc limit 1) d;
$$;

-- Passer un quiz : p_reponses = numéro de la réponse choisie pour chaque question (0 = la première), dans l'ordre.
-- Réussi si tout est juste. Renvoie {valide, total, fausses: [numéros des questions fausses]}.
create or replace function public.passer_quiz(p_module text, p_reponses smallint[]) returns jsonb language plpgsql security definer set search_path to '' as $$
declare total integer; fausses smallint[];
begin
  if auth.uid() is null then raise exception 'connexion'; end if;
  select count(*) into total from public.quiz_reponses r where r.module = p_module;
  if total = 0 then raise exception 'module inconnu'; end if;
  if coalesce(cardinality(p_reponses), 0) <> total then raise exception 'réponses incomplètes'; end if;
  select coalesce(array_agg(r.num order by r.num), '{}') into fausses
    from public.quiz_reponses r where r.module = p_module and p_reponses[r.num + 1] is distinct from r.bonne;
  insert into public.qualifications as q (cleaneur_id, module, essais, valide_le, dernier_essai_le)
  values (auth.uid(), p_module, 1, case when cardinality(fausses) = 0 then now() end, now())
  on conflict (cleaneur_id, module) do update set essais = q.essais + 1, dernier_essai_le = now(),
    valide_le = coalesce(q.valide_le, excluded.valide_le);
  return jsonb_build_object('valide', cardinality(fausses) = 0, 'total', total, 'fausses', to_jsonb(fausses));
end $$;

-- Formations qui manquent au Cleaneur pour les prestations de son profil (pour l'inviter à se former).
create or replace function public.formations_manquantes() returns text[] language sql stable security definer set search_path to '' as $$
  select coalesce(array_agg(distinct m), '{}') from (
    select unnest(public.qualifs_requises(r, null)) m
      from unnest(coalesce((select p.prestations from public.profils p where p.id = auth.uid()), '{}')) r) s
  where not (m = any (public.modules_valides(auth.uid())));
$$;

-- Missions disponibles : seulement celles pour lesquelles le Cleaneur est qualifié.
create or replace function public.missions_disponibles()
 returns table(reference text, rubrique_id text, creneau timestamptz, flexible boolean, duree_min integer, nombre_cleaneurs smallint, estimation_c integer, sur_devis boolean, code_postal text, ville text, cree_le timestamptz, urgence boolean, prime_urgence_c integer)
 language sql stable security definer set search_path to '' as $$
  select d.reference, d.rubrique_id, d.creneau, d.flexible, d.duree_min, d.nombre_cleaneurs, d.estimation_c, d.sur_devis, d.code_postal, d.ville, d.cree_le,
         d.urgence, d.prime_urgence_c
  from public.demandes d
  where public.cleaneur_actif() and d.statut = 'PUBLIEE' and d.cleaneur_id is null
    and (public.est_admin() or d.rubrique_id = any (coalesce((select p.prestations from public.profils p where p.id = auth.uid()), '{}')))
    and public.mission_visible(d) and public.qualifie(d)
  order by d.urgence desc, d.creneau nulls last, d.cree_le
  limit 100;
$$;

-- Prendre une mission : « qualification » si une formation manque.
create or replace function public.prendre_mission(p_reference text) returns text language plpgsql security definer set search_path to '' as $$
declare n integer;
begin
  if auth.uid() is null then return 'connexion'; end if;
  if not public.cleaneur_actif() then return 'dossier'; end if;
  if now() < timestamptz '2027-01-01 00:00 Europe/Paris' and not public.est_admin() then return 'ouverture'; end if;
  if not exists (select 1 from public.demandes d where d.reference = p_reference and public.mission_visible(d)) then return 'formule'; end if;
  if not exists (select 1 from public.demandes d where d.reference = p_reference and public.qualifie(d)) then return 'qualification'; end if;
  update public.demandes set cleaneur_id = auth.uid(), statut = 'CONFIRMEE'
   where reference = p_reference and statut = 'PUBLIEE' and cleaneur_id is null;
  get diagnostics n = row_count;
  if n = 1 then
    -- Première mission : début des 3 mois de Pro offerts (offre de lancement).
    update public.profils p set pro_offert_jusqu = now() + interval '3 months'
     where p.id = auth.uid() and p.pro_offert_jusqu is null and public.offre_lancement(p);
  end if;
  return case when n = 1 then 'ok' else 'deja_prise' end;
end $$;

revoke execute on function public.passer_quiz(text, smallint[]) from anon, public;
revoke execute on function public.mes_formations() from anon, public;
revoke execute on function public.formations_manquantes() from anon, public;
revoke execute on function public.modules_valides(uuid) from anon, public;
revoke execute on function public.qualifie(public.demandes) from anon, public;
grant execute on function public.passer_quiz(text, smallint[]) to authenticated;
grant execute on function public.mes_formations() to authenticated;
grant execute on function public.formations_manquantes() to authenticated;
revoke execute on function public.modules_valides(uuid) from authenticated;   -- appelées seulement par les fonctions ci-dessus
revoke execute on function public.qualifie(public.demandes) from authenticated;
