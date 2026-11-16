-- Sociétés de nettoyage avec salariés (16 novembre 2026, validé par l'utilisateur). Appliqué par Claude.
-- Principe : la société est un compte Cleaneur (dossier vérifié comme aujourd'hui : SIRET, RC Pro, URSSAF, contrat).
-- Elle invite ses salariés par un lien ; chaque salarié a son propre accès et sa pièce d'identité vérifiée par Cleaneroo.
-- La société prend une mission puis l'attribue : le salarié chef d'équipe devient le « Cleaneur de la mission »
-- (selfie du jour, trajet, étapes, compte rendu : rien ne change pour lui) ; ses équipiers voient la mission et font leur selfie.
-- La mission reste rattachée à la société (demandes.societe_id) : paiement, factures, statistiques et pourboires vont à la société.
-- Un salarié ne voit jamais le marché des missions, ni les prix, ni les paiements.

alter table public.profils add column if not exists societe_equipe boolean not null default false;
alter table public.profils add column if not exists employeur_id uuid references public.profils(id) on delete set null;
alter table public.demandes add column if not exists societe_id uuid references public.profils(id) on delete set null;
alter table public.demandes add column if not exists equipiers uuid[] not null default '{}';
create index if not exists demandes_societe on public.demandes (societe_id) where societe_id is not null;
create index if not exists demandes_equipiers on public.demandes using gin (equipiers);

create table if not exists public.societe_salaries (
  id uuid primary key default gen_random_uuid(),
  societe_id uuid not null references public.profils(id) on delete cascade,
  membre_id uuid references public.profils(id) on delete set null,
  prenom text not null check (char_length(prenom) between 1 and 80),
  nom text not null default '' check (char_length(nom) <= 80),
  contact text not null default '' check (char_length(contact) <= 120),
  code text not null unique,
  statut text not null default 'INVITE' check (statut in ('INVITE', 'A_VERIFIER', 'ACTIF', 'REFUSE', 'RETIRE')),
  motif text not null default '' check (char_length(motif) <= 300),
  cree_le timestamptz not null default now(), rejoint_le timestamptz, valide_le timestamptz
);
create index if not exists societe_salaries_societe on public.societe_salaries (societe_id);
alter table public.societe_salaries enable row level security;
drop policy if exists salaries_lecture on public.societe_salaries;
create policy salaries_lecture on public.societe_salaries for select using (societe_id = auth.uid() or membre_id = auth.uid() or public.est_admin());

/** Membre actif de la société appelante (ou la société elle-même). */
create or replace function public.membre_actif_de(p_societe uuid, p_membre uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select p_membre = p_societe or exists (select 1 from public.societe_salaries m where m.societe_id = p_societe and m.membre_id = p_membre and m.statut = 'ACTIF');
$$;

-- La société s'active (case « Je suis une société de nettoyage avec des salariés » dans l'espace Cleaneur).
create or replace function public.activer_societe_equipe(p_oui boolean) returns text language plpgsql security definer set search_path = '' as $$
declare p public.profils;
begin
  select * into p from public.profils where id = auth.uid();
  if p.id is null or p.role not in ('cleaneur', 'admin') or p.employeur_id is not null then return 'role'; end if;
  if p_oui and (coalesce(p.societe, '') = '' or not public.siren_siret_valide(coalesce(nullif(p.siret_societe, ''), p.siret))) then return 'societe'; end if;
  update public.profils set societe_equipe = p_oui where id = p.id;
  return 'ok';
end $$;

create or replace function public.inviter_salarie(p_prenom text, p_nom text, p_contact text) returns text language plpgsql security definer set search_path = '' as $$
declare c text;
begin
  if not exists (select 1 from public.profils where id = auth.uid() and societe_equipe and employeur_id is null) then return 'societe'; end if;
  if coalesce(trim(p_prenom), '') = '' then return 'prenom'; end if;
  if (select count(*) from public.societe_salaries where societe_id = auth.uid() and statut <> 'RETIRE') >= 60 then return 'limite'; end if;
  loop
    c := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    exit when not exists (select 1 from public.societe_salaries where code = c);
  end loop;
  insert into public.societe_salaries (societe_id, prenom, nom, contact, code) values (auth.uid(), left(trim(p_prenom), 80), left(trim(coalesce(p_nom, '')), 80), left(trim(coalesce(p_contact, '')), 120), c);
  return c;
end $$;

-- Le salarié ouvre le lien et crée son accès : il rejoint l'équipe (statut « À vérifier » jusqu'à la vérification de sa pièce d'identité).
create or replace function public.rejoindre_equipe(p_code text) returns text language plpgsql security definer set search_path = '' as $$
declare m public.societe_salaries; p public.profils;
begin
  if auth.uid() is null then return 'connexion'; end if;
  select * into m from public.societe_salaries where code = upper(trim(p_code));
  if m.id is null or m.statut in ('RETIRE', 'REFUSE') then return 'code'; end if;
  if m.membre_id is not null and m.membre_id <> auth.uid() then return 'code'; end if;
  select * into p from public.profils where id = auth.uid();
  if p.id = m.societe_id then return 'code'; end if;
  if p.role = 'admin' then return 'role'; end if;
  if p.role = 'cleaneur' and p.employeur_id is null and p.dossier = 'VALIDE' then return 'independant'; end if;
  update public.profils set role = 'cleaneur', employeur_id = m.societe_id, espace = 'cleaneur',
    statuts = case when 'cleaneur' = any (statuts) then statuts else statuts || 'cleaneur'::text end,
    prenom = coalesce(nullif(prenom, ''), m.prenom), nom = coalesce(nullif(nom, ''), m.nom)
  where id = auth.uid();
  update public.societe_salaries set membre_id = auth.uid(), statut = case when statut = 'ACTIF' then 'ACTIF' else 'A_VERIFIER' end, rejoint_le = coalesce(rejoint_le, now()) where id = m.id;
  perform public.notifier(m.societe_id, 'cleaneur', 'info', 'standard', m.prenom || ' a rejoint votre équipe', 'Sa pièce d''identité est en cours de vérification par Cleaneroo.', null);
  return 'ok';
end $$;

-- Équipe de la société : chaque membre, son statut, sa pièce d'identité, son selfie du jour, ses missions et sa note.
create or replace function public.mes_salaries()
 returns table(id uuid, membre_id uuid, prenom text, nom text, contact text, code text, statut text, motif text, cree_le timestamptz, rejoint_le timestamptz,
   identite boolean, selfie_du_jour text, missions_terminees integer, missions_a_venir integer, note numeric, nb_avis integer)
 language sql stable security definer set search_path = '' as $$
  select m.id, m.membre_id, m.prenom, m.nom, m.contact, m.code, m.statut, m.motif, m.cree_le, m.rejoint_le,
    exists (select 1 from public.documents_cleaneur d where d.cleaneur_id = m.membre_id and d.type = 'identite' and d.statut <> 'REFUSE'),
    coalesce((select s.statut from public.selfies_cleaneur s where s.cleaneur_id = m.membre_id and s.jour = (now() at time zone 'Europe/Paris')::date), 'aucun'),
    (select count(*)::int from public.demandes d where d.societe_id = m.societe_id and d.cleaneur_id = m.membre_id and d.statut = 'TERMINEE'),
    (select count(*)::int from public.demandes d where d.societe_id = m.societe_id and (d.cleaneur_id = m.membre_id or m.membre_id = any (d.equipiers))
       and d.statut in ('CONFIRMEE', 'EN_ROUTE', 'SUR_PLACE', 'EN_COURS')),
    (select round(avg(a.note)::numeric, 1) from public.avis a where a.cleaneur_id = m.membre_id and a.note is not null),
    (select count(*)::int from public.avis a where a.cleaneur_id = m.membre_id and a.note is not null)
  from public.societe_salaries m where m.societe_id = auth.uid() and m.statut <> 'RETIRE'
  order by (m.statut = 'ACTIF') desc, m.prenom;
$$;

create or replace function public.retirer_salarie(p_id uuid) returns text language plpgsql security definer set search_path = '' as $$
declare m public.societe_salaries;
begin
  select * into m from public.societe_salaries where id = p_id and societe_id = auth.uid();
  if m.id is null then return 'introuvable'; end if;
  update public.societe_salaries set statut = 'RETIRE' where id = m.id;
  if m.membre_id is not null then
    update public.profils set employeur_id = null where id = m.membre_id and employeur_id = m.societe_id;
    -- Missions confirmées pas encore commencées : elles reviennent à la société, à réattribuer.
    update public.demandes set cleaneur_id = m.societe_id where societe_id = m.societe_id and cleaneur_id = m.membre_id and statut = 'CONFIRMEE';
    update public.demandes set equipiers = array_remove(equipiers, m.membre_id) where societe_id = m.societe_id and m.membre_id = any (equipiers) and statut in ('CONFIRMEE', 'EN_ROUTE', 'SUR_PLACE', 'EN_COURS');
  end if;
  return 'ok';
end $$;

-- Missions de la société : celles qu'elle a prises (à attribuer) et celles de ses salariés.
create or replace function public.missions_societe()
 returns table(reference text, statut text, rubrique_id text, creneau timestamptz, duree_min integer, nombre_cleaneurs smallint, estimation_c integer,
   ville text, code_postal text, chef_id uuid, chef_prenom text, equipiers uuid[], equipiers_prenoms text[], details jsonb)
 language sql stable security definer set search_path = '' as $$
  select d.reference, d.statut, d.rubrique_id, d.creneau, d.duree_min, d.nombre_cleaneurs, d.estimation_c, d.ville, d.code_postal,
    case when d.cleaneur_id = auth.uid() then null else d.cleaneur_id end,
    case when d.cleaneur_id = auth.uid() then null else (select p.prenom from public.profils p where p.id = d.cleaneur_id) end,
    d.equipiers, array(select p.prenom from public.profils p where p.id = any (d.equipiers) order by p.prenom), coalesce(d.details, '{}'::jsonb)
  from public.demandes d
  where exists (select 1 from public.profils me where me.id = auth.uid() and me.societe_equipe)
    and (d.societe_id = auth.uid() or d.cleaneur_id = auth.uid())
    and d.statut in ('CONFIRMEE', 'EN_ROUTE', 'SUR_PLACE', 'EN_COURS', 'A_VALIDER', 'TERMINEE')
    and (d.statut <> 'TERMINEE' or d.creneau > now() - interval '45 days')
  order by d.creneau nulls last
  limit 300;
$$;

-- Attribution : un chef d'équipe (un salarié actif, ou la société elle-même pour la reprendre) et des équipiers, avant le départ.
create or replace function public.attribuer_mission(p_reference text, p_chef uuid, p_equipiers uuid[]) returns text language plpgsql security definer set search_path = '' as $$
declare d public.demandes; eq uuid[] := array(select distinct x from unnest(coalesce(p_equipiers, '{}')) x where x <> p_chef);
begin
  if not exists (select 1 from public.profils where id = auth.uid() and societe_equipe) then return 'societe'; end if;
  select * into d from public.demandes where reference = p_reference and (societe_id = auth.uid() or (cleaneur_id = auth.uid() and societe_id is null));
  if d.id is null then return 'introuvable'; end if;
  if d.statut <> 'CONFIRMEE' then return 'statut'; end if;
  if not public.membre_actif_de(auth.uid(), p_chef) then return 'membre'; end if;
  if exists (select 1 from unnest(eq) x where not public.membre_actif_de(auth.uid(), x) or x = auth.uid()) then return 'membre'; end if;
  update public.demandes set societe_id = auth.uid(), cleaneur_id = p_chef, equipiers = eq where id = d.id;
  if p_chef <> auth.uid() then
    perform public.notifier(p_chef, 'cleaneur', 'confirmee', 'important', 'Nouvelle mission pour vous', coalesce(d.ville, '') || ' · vous êtes chef d''équipe', d.reference);
  end if;
  perform public.notifier(x, 'cleaneur', 'confirmee', 'important', 'Nouvelle mission pour vous', coalesce(d.ville, '') || ' · en équipe', d.reference) from unnest(eq) x;
  return 'ok';
end $$;

-- Missions du salarié : celles dont il est chef d'équipe (comme avant) et celles où il est équipier.
create or replace function public.mes_missions()
 returns table(reference text, statut text, rubrique_id text, creneau timestamp with time zone, duree_min integer, estimation_c integer, sur_devis boolean, rue text, code_postal text, ville text, prenom text, telephone text, accueil text, remarque text, acces jsonb, details jsonb, etapes jsonb, urgence boolean, prime_urgence_c integer)
 language sql stable security definer set search_path = '' as $$
  select d.reference, d.statut, d.rubrique_id, d.creneau, d.duree_min,
    case when exists (select 1 from public.profils me where me.id = auth.uid() and me.employeur_id is not null) then 0 else d.estimation_c end,
    d.sur_devis, d.rue, d.code_postal, d.ville,
    d.prenom, d.telephone, d.accueil, d.remarque, coalesce(d.acces, '{}'::jsonb), coalesce(d.details, '{}'::jsonb), d.etapes, d.urgence,
    case when exists (select 1 from public.profils me where me.id = auth.uid() and me.employeur_id is not null) then 0 else d.prime_urgence_c end
  from public.demandes d
  where (d.cleaneur_id = auth.uid() or auth.uid() = any (d.equipiers))
    and (d.statut in ('CONFIRMEE', 'EN_ROUTE', 'SUR_PLACE', 'EN_COURS') or (d.statut = 'A_VALIDER' and not (d.etapes ? 'depart')))
  order by d.creneau nulls last;
$$;

-- Ce que voit un salarié de son employeur et de son statut.
create or replace function public.mon_employeur() returns json language sql stable security definer set search_path = '' as $$
  select json_build_object('societe', e.societe, 'prenom', e.prenom, 'telephone', e.telephone, 'statut', m.statut, 'motif', m.motif,
    'identite', exists (select 1 from public.documents_cleaneur d where d.cleaneur_id = auth.uid() and d.type = 'identite' and d.statut <> 'REFUSE'))
  from public.profils me join public.profils e on e.id = me.employeur_id
  left join public.societe_salaries m on m.societe_id = e.id and m.membre_id = me.id
  where me.id = auth.uid();
$$;

-- Administration : salariés dont la pièce d'identité est à vérifier, puis décision.
create or replace function public.salaries_a_verifier()
 returns table(id uuid, societe text, prenom text, nom text, membre_id uuid, statut text, identite text, rejoint_le timestamptz)
 language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.est_admin() then raise exception 'réservé à l''administration'; end if;
  return query select m.id, s.societe, m.prenom, m.nom, m.membre_id, m.statut,
    (select d.chemin from public.documents_cleaneur d where d.cleaneur_id = m.membre_id and d.type = 'identite' and d.statut <> 'REFUSE' order by d.cree_le desc limit 1), m.rejoint_le
  from public.societe_salaries m join public.profils s on s.id = m.societe_id
  where m.statut in ('A_VERIFIER', 'ACTIF', 'REFUSE') order by (m.statut = 'A_VERIFIER') desc, m.rejoint_le desc nulls last limit 200;
end $$;
create or replace function public.decider_salarie(p_id uuid, p_valide boolean, p_motif text default '') returns text language plpgsql security definer set search_path = '' as $$
declare m public.societe_salaries;
begin
  if not public.est_admin() then return 'interdit'; end if;
  update public.societe_salaries set statut = case when p_valide then 'ACTIF' else 'REFUSE' end, motif = left(coalesce(p_motif, ''), 300),
    valide_le = case when p_valide then now() else valide_le end where id = p_id returning * into m;
  if m.id is null then return 'introuvable'; end if;
  perform public.notifier(m.societe_id, 'cleaneur', 'info', 'standard', case when p_valide then m.prenom || ' peut intervenir' else 'Identité de ' || m.prenom || ' refusée' end,
    case when p_valide then 'Vous pouvez lui attribuer des missions.' else coalesce(nullif(p_motif, ''), 'Pièce d''identité non conforme.') end, null);
  if m.membre_id is not null then perform public.notifier(m.membre_id, 'cleaneur', 'info', 'standard', case when p_valide then 'Votre identité est vérifiée' else 'Pièce d''identité refusée' end,
    case when p_valide then 'Votre employeur peut vous attribuer des missions.' else coalesce(nullif(p_motif, ''), 'Envoyez une nouvelle photo de votre pièce d''identité.') end, null); end if;
  return 'ok';
end $$;

-- Le client voit le prénom de l'intervenant et sa société.
drop function if exists public.cleaneurs_de_mes_demandes();
create or replace function public.cleaneurs_de_mes_demandes() returns table(reference text, prenom text, niveau integer, societe text) language sql stable security definer set search_path = '' as $$
  select d.reference, p.prenom, coalesce((public.niveau_de(d.cleaneur_id)->>'niveau')::int, 0), coalesce((select s.societe from public.profils s where s.id = d.societe_id), '')
  from public.demandes d join public.profils p on p.id = d.cleaneur_id
  where d.client_id = auth.uid() and d.cleaneur_id is not null and d.statut <> 'ANNULEE';
$$;

-- Activité : la société compte les missions de ses salariés, leurs pourboires et leurs primes.
create or replace function public.tableau_cleaneur() returns json language sql stable security definer set search_path = '' as $$
  select json_build_object(
    'missions_terminees', (select count(*) from public.demandes where (cleaneur_id = auth.uid() or societe_id = auth.uid()) and statut = 'TERMINEE'),
    'formule', public.formule_effective(auth.uid()),
    'pro_offert_jusqu', (select pro_offert_jusqu from public.profils where id = auth.uid()),
    'dispo_urgence_jusqu', (select case when urgence_dispo_jusqu > now() then urgence_dispo_jusqu end from public.profils where id = auth.uid()),
    'note_moyenne', (select round(avg(a.note)::numeric, 1) from public.avis a where (a.cleaneur_id = auth.uid() or exists (select 1 from public.demandes d where d.reference = a.reference and d.societe_id = auth.uid())) and a.note is not null and public.avis_revele(a)),
    'nb_avis', (select count(*) from public.avis a where (a.cleaneur_id = auth.uid() or exists (select 1 from public.demandes d where d.reference = a.reference and d.societe_id = auth.uid())) and a.note is not null and public.avis_revele(a)),
    'pourboires_c', (select coalesce(sum(pourboire_c), 0) from public.avis a where a.cleaneur_id = auth.uid() or exists (select 1 from public.demandes d where d.reference = a.reference and d.societe_id = auth.uid())),
    'societe_equipe', (select societe_equipe from public.profils where id = auth.uid()),
    'employeur', (select employeur_id is not null from public.profils where id = auth.uid()));
$$;
create or replace function public.mon_portefeuille() returns json language sql stable security definer set search_path = '' as $$
  with an as (select date_trunc('year', now()) as debut)
  select json_build_object(
    'prestations_c', coalesce((select sum(total_ttc_c) from public.factures, an where type = 'prestation' and cleaneur_id = auth.uid() and date_emission >= an.debut), 0),
    'commissions_c', coalesce((select sum(total_ttc_c) from public.factures, an where type = 'commission' and client_id = auth.uid() and date_emission >= an.debut), 0),
    'pourboires_c', coalesce((select sum(a.pourboire_c) from public.avis a, an where (a.cleaneur_id = auth.uid() or exists (select 1 from public.demandes d where d.reference = a.reference and d.societe_id = auth.uid())) and a.cree_le >= an.debut), 0),
    'primes_c', coalesce((select sum(prime_urgence_c) from public.demandes, an where (cleaneur_id = auth.uid() or societe_id = auth.uid()) and statut = 'TERMINEE' and maj_le >= an.debut), 0),
    'moins_values_c', coalesce((select sum(montant_c) from public.penalites_cleaneur, an where cleaneur_id = auth.uid() and statut = 'APPLIQUEE' and cree_le >= an.debut), 0));
$$;

-- Salariés : ils ne prennent jamais de mission sur le marché (seule la société le fait).
create or replace function public.cleaneur_actif() returns boolean language sql stable security definer set search_path = '' as $$
  select public.est_admin() or exists (select 1 from public.profils p where p.id = auth.uid() and p.role = 'cleaneur' and p.dossier = 'VALIDE'
    and p.banni_le is null and p.mission_test = 'REUSSIE' and p.employeur_id is null);
$$;

revoke execute on function public.activer_societe_equipe(boolean), public.inviter_salarie(text, text, text), public.rejoindre_equipe(text), public.mes_salaries(),
  public.retirer_salarie(uuid), public.missions_societe(), public.attribuer_mission(text, uuid, uuid[]), public.mon_employeur(),
  public.salaries_a_verifier(), public.decider_salarie(uuid, boolean, text), public.membre_actif_de(uuid, uuid) from anon, public;
grant execute on function public.activer_societe_equipe(boolean), public.inviter_salarie(text, text, text), public.rejoindre_equipe(text), public.mes_salaries(),
  public.retirer_salarie(uuid), public.missions_societe(), public.attribuer_mission(text, uuid, uuid[]), public.mon_employeur(),
  public.salaries_a_verifier(), public.decider_salarie(uuid, boolean, text) to authenticated;

revoke execute on function public.cleaneurs_de_mes_demandes() from anon, public;
grant execute on function public.cleaneurs_de_mes_demandes() to authenticated;

-- Factures : quand un salarié intervient, la prestation est facturée au nom de la société (raison sociale, SIRET), qui reçoit aussi la commission.
create or replace function public.emettre_factures(p_reference text) returns void language plpgsql security definer set search_path = '' as $$
declare d public.demandes; c public.profils; cl public.profils; an text; info jsonb; tva numeric; frais integer; com_pb integer; com integer; dest jsonb; nom_r text; e_cleaneroo jsonb;
  payeur uuid; emet jsonb;
begin
  select * into d from public.demandes where reference = p_reference;
  if d.id is null or d.statut <> 'TERMINEE' or d.cleaneur_id is null then return; end if;
  payeur := coalesce(d.societe_id, d.cleaneur_id);
  select * into c from public.profils where id = payeur;
  select * into cl from public.profils where id = d.client_id;
  an := to_char(now() at time zone 'Europe/Paris', 'YYYY');
  select jsonb_object_agg(cle, valeur) into info from public.infos_cleaneroo;
  tva := coalesce(nullif(info->>'tva_frais_pct', ''), '20')::numeric;
  e_cleaneroo := jsonb_build_object('nom', info->>'raison_sociale', 'siret', info->>'siret', 'adresse', info->>'adresse', 'tva_intracom', info->>'tva_intracom', 'email', info->>'email');
  nom_r := coalesce((select r from (values ('home','Ménage du logement'),('rental','Ménage de location saisonnière'),('moving','Ménage de déménagement'),
    ('car','Nettoyage de véhicule'),('leisure','Nettoyage de van, camping-car ou caravane'),('boat','Nettoyage de bateau'),('hospitality','Nettoyage d''hébergements (hôtel, camping)'),
    ('textiles','Nettoyage de canapés et textiles'),('construction','Nettoyage de fin de chantier'),('kitchen','Nettoyage de cuisine'),
    ('office','Nettoyage de bureaux'),('commerce','Nettoyage de commerce'),('communal','Nettoyage de parties communes'),('windows','Nettoyage de vitres'),
    ('outdoor','Nettoyage d''espaces extérieurs'),('event','Nettoyage avant / après événement'),('special','Prestation spécialisée')) v(id, r) where id = d.rubrique_id), 'Prestation de nettoyage');
  dest := jsonb_build_object('nom', trim(d.prenom || ' ' || d.nom), 'societe', case when d.espace <> 'personnel' then coalesce(cl.societe, '') else '' end,
    'siret', case when d.espace <> 'personnel' then coalesce(nullif(cl.siret_societe, ''), cl.siret, '') else '' end,
    'adresse', d.rue || ', ' || d.code_postal || ' ' || d.ville, 'email', d.email);
  emet := jsonb_build_object('nom', case when d.societe_id is not null and coalesce(c.societe, '') <> '' then c.societe else trim(c.prenom || ' ' || c.nom) end,
    'siret', case when d.societe_id is not null then coalesce(nullif(c.siret_societe, ''), c.siret) else c.siret end,
    'adresse', trim(coalesce(c.code_postal, '') || ' ' || coalesce(c.ville, '')));
  -- 1. Prestation (au nom du Cleaneur, ou de sa société quand un salarié intervient).
  if not exists (select 1 from public.factures where reference = d.reference and type = 'prestation') then
    insert into public.factures (numero, type, reference, emetteur, destinataire, client_id, cleaneur_id, espace, lignes, total_ht_c, tva_c, total_ttc_c, description)
    values (public.prochain_numero('C' || upper(substr(replace(payeur::text, '-', ''), 1, 6)) || '-' || an), 'prestation', d.reference,
      emet || jsonb_build_object('mention_tva', 'TVA non applicable, art. 293 B du CGI', 'mandat', 'Facture établie par Cleaneroo au nom et pour le compte du prestataire (mandat de facturation).'),
      dest, d.client_id, payeur, d.espace,
      jsonb_build_array(jsonb_build_object('libelle', nom_r || ' · ' || to_char(coalesce(d.creneau, now()) at time zone 'Europe/Paris', 'DD/MM/YYYY') || ' · ' || d.ville, 'quantite', 1, 'prix_ht_c', d.estimation_c, 'tva_pct', 0)),
      d.estimation_c, 0, d.estimation_c, '');
  end if;
  -- 2. Frais de service Cleaneroo (TTC → HT + TVA).
  frais := coalesce((d.details->>'fraisServiceC')::integer, 0);
  if frais > 0 and not exists (select 1 from public.factures where reference = d.reference and type = 'frais') then
    insert into public.factures (numero, type, reference, emetteur, destinataire, client_id, cleaneur_id, espace, lignes, total_ht_c, tva_c, total_ttc_c)
    values (public.prochain_numero('CLN-' || an), 'frais', d.reference, e_cleaneroo, dest, d.client_id, payeur, d.espace,
      jsonb_build_array(jsonb_build_object('libelle', 'Frais de service Cleaneroo · prestation ' || d.reference, 'quantite', 1, 'prix_ht_c', round(frais / (1 + tva / 100)), 'tva_pct', tva)),
      round(frais / (1 + tva / 100)), frais - round(frais / (1 + tva / 100)), frais);
  end if;
  -- 3. Commission Cleaneroo facturée au prestataire (selon sa formule : Pro 12 %, Gratuit 20 %).
  com_pb := case when public.formule_effective(payeur) = 'pro' then 1200 else 2000 end;
  com := round(coalesce(d.estimation_initiale_c, d.estimation_c) * com_pb / 10000.0);
  if com > 0 and not exists (select 1 from public.factures where reference = d.reference and type = 'commission') then
    insert into public.factures (numero, type, reference, emetteur, destinataire, client_id, cleaneur_id, espace, lignes, total_ht_c, tva_c, total_ttc_c)
    values (public.prochain_numero('CLN-' || an), 'commission', d.reference, e_cleaneroo, emet, payeur, payeur, 'cleaneur',
      jsonb_build_array(jsonb_build_object('libelle', 'Commission Cleaneroo (' || (com_pb / 100) || ' %) · prestation ' || d.reference, 'quantite', 1, 'prix_ht_c', round(com / (1 + tva / 100)), 'tva_pct', tva)),
      round(com / (1 + tva / 100)), com - round(com / (1 + tva / 100)), com);
  end if;
end $$;

-- Formations dans les sociétés (16 novembre 2026) : la société est garante de la formation de ses salariés.
-- formations_exigees(d), qualifie(d) (la société ou un salarié actif formé), attribuer_mission (chef et équipiers formés),
-- mes_salaries (formations validées) et missions_societe (formations exigées de chaque mission) : appliqués par migration « societe_formations_16nov ».
-- invitation_salarie(code) : page « Rejoindre l'équipe », appliquée par migration « invitation_salarie_16nov ».
