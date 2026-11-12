-- Dossier Cleaneur complet (12 novembre 2026, repris de l'appli iPhone de Vincent).
-- 1. Mission test rémunérée (40 €, payée par Cleaneroo) : une première mission accompagnée avant l'activation complète ;
--    l'administration la note « réussie » ou « à refaire » (motif). Sans mission test réussie, aucune mission n'est proposée.
-- 2. RC Pro : activités couvertes, renseignées par l'administration ; une mission n'est proposée que si son activité est couverte
--    (rien de renseigné = pas encore restreint).
-- 3. Contrat de prestataire signé (version, date, signature au doigt) avant d'envoyer le dossier.
-- 4. Fin de validité des documents ; relance chaque lundi à 8 h quand un document expire dans moins de 30 jours.
-- 5. « Ce que je peux recevoir, et ce qui me manque » : ce_qui_me_manque().

alter table public.profils add column if not exists mission_test text not null default 'A_PLANIFIER';
alter table public.profils drop constraint if exists profils_mission_test_check;
alter table public.profils add constraint profils_mission_test_check check (mission_test in ('A_PLANIFIER', 'REUSSIE', 'A_REFAIRE'));
alter table public.profils add column if not exists mission_test_motif text not null default '';
alter table public.profils add column if not exists rc_pro_activites text[];
alter table public.profils add column if not exists contrat_version text;
alter table public.profils add column if not exists contrat_signe_le timestamptz;
alter table public.profils add column if not exists contrat_signature text;
alter table public.documents_cleaneur add column if not exists expire_le date;

-- Activité RC Pro exigée par une prestation (copie de activiteRcPro dans regles.js et Regles.kt).
create or replace function public.activite_rc_pro(p_rubrique text, p_type_lieu text) returns text language sql immutable set search_path to '' as $$
  select case p_rubrique
    when 'home' then 'domicile' when 'rental' then 'domicile' when 'moving' then 'domicile'
    when 'kitchen' then case when coalesce(p_type_lieu, 'particulier') in ('', 'particulier') then 'domicile' else 'cuisines_pro' end
    when 'office' then case when p_type_lieu = 'medical' then 'medical' else 'locaux' end
    when 'commerce' then 'locaux' when 'communal' then 'locaux' when 'windows' then 'vitres' when 'construction' then 'chantier'
    when 'car' then 'vehicules' when 'textiles' then 'textiles' when 'outdoor' then 'exterieurs' when 'event' then 'evenementiel'
    when 'special' then 'specialise' else 'domicile' end;
$$;

-- La RC Pro du Cleaneur connecté couvre-t-elle cette demande ?
create or replace function public.rc_pro_couvre(d public.demandes) returns boolean language sql stable security definer set search_path to '' as $$
  select public.est_admin() or coalesce((select p.rc_pro_activites is null or public.activite_rc_pro(d.rubrique_id, d.details->>'typeLieuId') = any (p.rc_pro_activites)
    from public.profils p where p.id = auth.uid()), false);
$$;
revoke execute on function public.rc_pro_couvre(public.demandes) from anon, public, authenticated;

-- Cleaneur actif : dossier validé, pas banni, et mission test réussie.
create or replace function public.cleaneur_actif() returns boolean language sql stable security definer set search_path to '' as $$
  select public.est_admin() or exists (select 1 from public.profils p where p.id = auth.uid() and p.role = 'cleaneur' and p.dossier = 'VALIDE'
    and p.banni_le is null and p.mission_test = 'REUSSIE');
$$;

-- Missions disponibles : en plus, activité couverte par la RC Pro.
drop function if exists public.missions_disponibles();
create function public.missions_disponibles()
 returns table(reference text, rubrique_id text, creneau timestamptz, flexible boolean, duree_min integer, nombre_cleaneurs smallint, estimation_c integer, sur_devis boolean, code_postal text, ville text, cree_le timestamptz, urgence boolean, prime_urgence_c integer, choix_cleaneur text)
 language sql stable security definer set search_path to '' as $$
  select d.reference, d.rubrique_id, d.creneau, d.flexible, d.duree_min, d.nombre_cleaneurs, d.estimation_c, d.sur_devis, d.code_postal, d.ville, d.cree_le,
         d.urgence, d.prime_urgence_c, case when d.urgence then 'directe' else coalesce(d.choix_cleaneur, 'candidatures') end
  from public.demandes d
  where public.cleaneur_actif() and d.statut = 'PUBLIEE' and d.cleaneur_id is null
    and (public.est_admin() or d.rubrique_id = any (coalesce((select p.prestations from public.profils p where p.id = auth.uid()), '{}')))
    and public.mission_visible(d) and public.qualifie(d) and not public.periode_fermee(d) and public.rc_pro_couvre(d)
  order by d.urgence desc, d.creneau nulls last, d.cree_le
  limit 100;
$$;
revoke execute on function public.missions_disponibles() from anon, public;
grant execute on function public.missions_disponibles() to authenticated;

-- Prendre et proposer : refus « assurance » si l'activité n'est pas couverte.
do $$ declare f text;
begin
  f := pg_get_functiondef('public.prendre_mission'::regproc);
  if position('rc_pro_couvre' in f) = 0 then
    execute replace(f, '  if exists (select 1 from public.demandes d where d.reference = p_reference and public.periode_fermee(d)) then return ''fermee''; end if;',
      '  if exists (select 1 from public.demandes d where d.reference = p_reference and public.periode_fermee(d)) then return ''fermee''; end if;
  if not exists (select 1 from public.demandes d where d.reference = p_reference and public.rc_pro_couvre(d)) then return ''assurance''; end if;');
  end if;
  f := pg_get_functiondef('public.proposer(text, integer, text, text, integer, timestamptz, text)'::regprocedure);
  if position('rc_pro_couvre' in f) = 0 then
    execute replace(f, 'and not public.periode_fermee(d)) then return ''indisponible''; end if;',
      'and not public.periode_fermee(d)) then return ''indisponible''; end if;
  if not public.rc_pro_couvre(d) then return ''assurance''; end if;');
  end if;
  -- Dossier : contrat de prestataire signé avant l'envoi.
  f := pg_get_functiondef('public.soumettre_dossier'::regproc);
  if position('contrat_signe_le' in f) = 0 then
    execute replace(f, '  update public.profils set dossier = ''A_VERIFIER''',
      '  if p.contrat_signe_le is null then return ''contrat''; end if;
  update public.profils set dossier = ''A_VERIFIER''');
  end if;
end $$;

-- Signer le contrat de prestataire (version affichée, signature PNG).
create or replace function public.signer_contrat(p_version text, p_signature text) returns text language plpgsql security definer set search_path to '' as $$
begin
  if auth.uid() is null then return 'connexion'; end if;
  if coalesce(p_version, '') = '' or p_signature not like 'data:image/png;base64,%' or char_length(p_signature) > 300000 then return 'invalide'; end if;
  update public.profils set contrat_version = left(p_version, 40), contrat_signe_le = now(), contrat_signature = p_signature where id = auth.uid();
  return 'ok';
end $$;
grant execute on function public.signer_contrat(text, text) to authenticated;

-- Administration : mission test et activités de la RC Pro.
create or replace function public.decider_mission_test(p_cleaneur uuid, p_reussie boolean, p_motif text default '') returns text language plpgsql security definer set search_path to '' as $$
begin
  if not public.est_admin() then return 'interdit'; end if;
  update public.profils set mission_test = case when p_reussie then 'REUSSIE' else 'A_REFAIRE' end,
    mission_test_motif = case when p_reussie then '' else left(coalesce(p_motif, ''), 300) end where id = p_cleaneur;
  perform public.notifier(p_cleaneur, 'cleaneur', case when p_reussie then 'confirmee' else 'alerte' end, 'important',
    case when p_reussie then 'Mission test réussie' else 'Mission test à refaire' end,
    case when p_reussie then 'Les missions vous sont maintenant proposées.' else left(coalesce(p_motif, ''), 300) end, null);
  return 'ok';
end $$;
create or replace function public.definir_activites_rc_pro(p_cleaneur uuid, p_activites text[]) returns text language plpgsql security definer set search_path to '' as $$
begin
  if not public.est_admin() then return 'interdit'; end if;
  update public.profils set rc_pro_activites = p_activites where id = p_cleaneur;
  return 'ok';
end $$;
grant execute on function public.decider_mission_test(uuid, boolean, text) to authenticated;
grant execute on function public.definir_activites_rc_pro(uuid, text[]) to authenticated;

-- Ce que je peux recevoir, et ce qui me manque (Cleaneur connecté).
create or replace function public.ce_qui_me_manque() returns json language sql stable security definer set search_path to '' as $$
  select json_build_object(
    'dossier', p.dossier, 'mission_test', p.mission_test, 'mission_test_motif', p.mission_test_motif,
    'contrat_signe', p.contrat_signe_le is not null, 'rc_pro_activites', p.rc_pro_activites,
    'formations_manquantes', public.formations_manquantes(),
    'documents_expirent', (select coalesce(json_agg(json_build_object('type', dc.type, 'expire_le', dc.expire_le) order by dc.expire_le), '[]'::json)
      from public.documents_cleaneur dc where dc.cleaneur_id = p.id and dc.statut <> 'REFUSE' and dc.expire_le is not null and dc.expire_le <= current_date + 30))
  from public.profils p where p.id = auth.uid();
$$;
grant execute on function public.ce_qui_me_manque() to authenticated;

-- Relance du lundi 8 h : documents qui expirent dans moins de 30 jours.
create or replace function public.relance_documents() returns void language plpgsql security definer set search_path to '' as $$
declare r record;
begin
  for r in select dc.cleaneur_id, min(dc.expire_le) as fin from public.documents_cleaneur dc
           where dc.statut <> 'REFUSE' and dc.expire_le is not null and dc.expire_le <= current_date + 30 group by dc.cleaneur_id loop
    perform public.notifier(r.cleaneur_id, 'cleaneur', 'alerte', 'important', '⚠️ Document à mettre à jour',
      'Un de vos documents expire le ' || to_char(r.fin, 'DD/MM/YYYY') || ' : déposez la nouvelle version.', null);
  end loop;
end $$;
revoke execute on function public.relance_documents() from anon, public, authenticated;
select cron.schedule('relance-documents', '0 7 * * 1', 'select public.relance_documents()');   -- lundi 8 h (heure de Paris en hiver)

-- Administration : mission test, activités RC Pro et contrat d'un Cleaneur.
create or replace function public.infos_dossier(p_cleaneur uuid) returns json language sql stable security definer set search_path to '' as $$
  select json_build_object('mission_test', p.mission_test, 'mission_test_motif', p.mission_test_motif, 'rc_pro_activites', p.rc_pro_activites,
    'contrat_version', p.contrat_version, 'contrat_signe_le', p.contrat_signe_le)
  from public.profils p where p.id = p_cleaneur and public.est_admin();
$$;
grant execute on function public.infos_dossier(uuid) to authenticated;
