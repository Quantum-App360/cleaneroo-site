-- Lot 7 du prompt 4 (notifications, messagerie, réputation), partie base de données. 25/11/2026.
-- À appliquer seulement avec l'accord de Michael. Même logique à reporter dans les applis (Vincent).
--
-- 1. Correctif : la notification « Nouveau message » reprenait le texte AVANT masquage des coordonnées (un numéro masqué dans
--    la conversation restait lisible dans la notification). Elle reprend maintenant le texte masqué.
-- 2. Plus d'emoji dans les textes de la base (« 📷 » → « Photo », « ⚠️ » retiré), y compris les notifications déjà envoyées.
-- 3. infos_fil : en-tête d'une conversation (prestation, date, statut, ville, interlocuteur) et « Lu » sous mon dernier message.
-- 4. reputation_cleaneur : note globale, nombre d'avis, répartition 5 → 1, notes par critère, taux de satisfaction,
--    avis récents ; seulement les avis publiés (double aveugle respecté). Lecture publique, comme les fiches.
-- 5. Correctif : la note des fiches publiques (cleaneurs_publics) ne compte plus que les avis publiés (avant : un avis encore
--    caché par le double aveugle faisait déjà bouger la note, ce qui le dévoilait au Cleaneur).
-- 6. Rappel de mission : la veille à 18 h, le client et le Cleaneur sont prévenus de la prestation du lendemain.

/* ---------------------------------------------------------------- 1 et 2. Messages */
create or replace function public.envoyer_message(p_fil text, p_texte text, p_photo text DEFAULT ''::text)
 returns text language plpgsql security definer set search_path = '' as $$
declare v_texte text; r text := public.role_dans_fil(p_fil); d public.demandes; dest uuid; espace text;
begin
  if r is null then return 'interdit'; end if;
  if coalesce(trim(p_texte), '') = '' and coalesce(p_photo, '') = '' then return 'vide'; end if;
  if coalesce(p_photo, '') <> '' and p_photo not like replace(p_fil, ':', '-') || '/%' then return 'invalide'; end if;
  -- Coordonnées masquées (23/11/2026) : plus de passage en direct par la messagerie.
  v_texte := public.masquer_coordonnees(left(trim(coalesce(p_texte, '')), 2000));
  if v_texte <> left(trim(coalesce(p_texte, '')), 2000) and r <> 'support' then
    perform public.noter_tentative(auth.uid(), p_fil, p_texte, case when r = 'cleaneur' then 'cleaneur' else 'client' end);
  end if;
  insert into public.messages (fil, auteur, role, texte, photo) values (p_fil, auth.uid(), r, v_texte, coalesce(p_photo, ''));
  if p_fil like 'support:%' then
    if r = 'support' then dest := substr(p_fil, 9)::uuid; espace := 'client'; end if;
  else
    select * into d from public.demandes where reference = p_fil;
    if r = 'client' then dest := d.cleaneur_id; espace := 'cleaneur';
    elsif r = 'cleaneur' then dest := d.client_id; espace := 'client';
    else dest := d.client_id; espace := 'client'; end if;
  end if;
  if dest is not null and not exists (select 1 from public.notifications n where n.destinataire = dest and n.reference = p_fil
      and n.titre = 'Nouveau message' and not n.lu) then
    perform public.notifier(dest, espace, 'info', 'important', 'Nouveau message', left(coalesce(nullif(v_texte, ''), 'Photo'), 120), p_fil);
  end if;
  return 'ok';
end $$;

create or replace function public.mes_conversations()
 returns table(fil text, rubrique_id text, ville text, avec text, dernier text, dernier_le timestamp with time zone, non_lus integer)
 language sql stable security definer set search_path = '' as $$
  with fils as (
    select d.reference as fil, d.rubrique_id, d.ville, coalesce(p.prenom, '') as avec, 'client' as moi
      from public.demandes d left join public.profils p on p.id = d.cleaneur_id
      where d.client_id = auth.uid() and d.cleaneur_id is not null and d.statut <> 'ANNULEE'
    union all
    select d.reference, d.rubrique_id, d.ville, d.prenom, 'cleaneur'
      from public.demandes d where d.cleaneur_id = auth.uid() and d.statut <> 'ANNULEE'
    union all
    select 'support:' || auth.uid()::text, null, null, 'Cleaneroo · Support', 'client' where auth.uid() is not null)
  select f.fil, f.rubrique_id, f.ville, f.avec,
    (select coalesce(nullif(m.texte, ''), 'Photo') from public.messages m where m.fil = f.fil order by m.cree_le desc limit 1),
    (select max(m.cree_le) from public.messages m where m.fil = f.fil),
    (select count(*)::int from public.messages m where m.fil = f.fil and m.role <> f.moi and not m.lu)
  from fils f
  order by 6 desc nulls last;
$$;

create or replace function public.relance_documents() returns void language plpgsql security definer set search_path = '' as $$
declare r record;
begin
  for r in select dc.cleaneur_id, min(dc.expire_le) as fin from public.documents_cleaneur dc
           where dc.statut <> 'REFUSE' and dc.expire_le is not null and dc.expire_le <= current_date + 30 group by dc.cleaneur_id loop
    perform public.notifier(r.cleaneur_id, 'cleaneur', 'alerte', 'important', 'Document à mettre à jour',
      'Un de vos documents expire le ' || to_char(r.fin, 'DD/MM/YYYY') || ' : déposez la nouvelle version.', null);
  end loop;
end $$;

update public.notifications set titre = 'Document à mettre à jour' where titre = '⚠️ Document à mettre à jour';
update public.notifications set texte = 'Photo' where titre = 'Nouveau message' and texte = '📷';

/* ---------------------------------------------------------------- 3. En-tête d'une conversation */
create or replace function public.infos_fil(p_fil text) returns json
 language plpgsql stable security definer set search_path = '' as $$
declare r text := public.role_dans_fil(p_fil); d public.demandes; avec text; lu boolean;
begin
  if r is null then return null; end if;
  select m.lu into lu from public.messages m where m.fil = p_fil and m.auteur = auth.uid() order by m.cree_le desc limit 1;
  if p_fil like 'support:%' then return json_build_object('moi', r, 'dernier_lu', lu); end if;
  select * into d from public.demandes where reference = p_fil;
  if r = 'cleaneur' then avec := d.prenom; else select p.prenom into avec from public.profils p where p.id = d.cleaneur_id; end if;
  return json_build_object('moi', r, 'rubrique_id', d.rubrique_id, 'creneau', d.creneau, 'duree_min', d.duree_min, 'statut', d.statut,
    'ville', d.ville, 'avec', avec, 'dernier_lu', lu);
end $$;

/* ---------------------------------------------------------------- 4. Réputation d'un Cleaneur (fiche publique) */
create or replace function public.reputation_cleaneur(p_cleaneur uuid) returns json
 language sql stable security definer set search_path = '' as $$
  with c as (select p.id from public.profils p where p.id = p_cleaneur and p.dossier = 'VALIDE' and p.banni_le is null),
  a as (select av.* from public.avis av join c on c.id = av.cleaneur_id where av.note between 1 and 5 and public.avis_revele(av))
  select json_build_object(
    'nombre', (select count(*) from a),
    'moyenne', (select round(avg(note)::numeric, 1) from a),
    'satisfaction', (select case when count(*) = 0 then null else round(100.0 * count(*) filter (where note >= 4) / count(*)) end from a),
    'repartition', (select json_build_object('5', count(*) filter (where note = 5), '4', count(*) filter (where note = 4), '3', count(*) filter (where note = 3),
       '2', count(*) filter (where note = 2), '1', count(*) filter (where note = 1)) from a),
    'criteres', (select json_build_object(
       'qualite', round(avg((categories->>'qualite')::numeric) filter (where categories ? 'qualite'), 1),
       'ponctualite', round(avg((categories->>'ponctualite')::numeric) filter (where categories ? 'ponctualite'), 1),
       'communication', round(avg((categories->>'communication')::numeric) filter (where categories ? 'communication'), 1),
       'consignes', round(avg((categories->>'consignes')::numeric) filter (where categories ? 'consignes'), 1)) from a),
    'avis', coalesce((select json_agg(x order by x.tri desc) from (
       select a.cree_le as tri, a.note, d.rubrique_id as rubrique,
         nullif(trim(regexp_replace(regexp_replace(coalesce(a.commentaire, ''),
           '[[:alnum:]._%+-]+@[[:alnum:].-]+\.[[:alpha:]]{2,}', '[masqué]', 'g'), '(\+?\d[\d .-]{7,}\d)', '[masqué]', 'g')), '') as commentaire,
         initcap(split_part(coalesce(nullif(trim(d.prenom), ''), 'Client'), ' ', 1)) || coalesce(' ' || upper(left(nullif(trim(d.nom), ''), 1)) || '.', '') as auteur,
         to_char(a.cree_le at time zone 'Europe/Paris', 'YYYY-MM') as mois
       from a join public.demandes d on d.reference = a.reference order by a.cree_le desc limit 5) x), '[]'::json)
  ) where exists (select 1 from c);
$$;

/* ---------------------------------------------------------------- 5. Note des fiches publiques : avis publiés seulement */
create or replace function public.cleaneurs_publics(p_rubrique text, p_lat double precision, p_lon double precision)
 returns table(cleaneur_id uuid, prenom text, initiale text, note numeric, nb_avis integer, realisees integer, niveau integer, pro boolean,
   prestations text[], prochains_jours date[], inscrit_le date, distance_km integer)
 language sql stable security definer set search_path = '' as $$
  with c as (
    select p.*,
      public.km_entre(round(p.zone_lat::numeric * 20)::float8 / 20, round(p.zone_lon::numeric * 20)::float8 / 20, p_lat, p_lon) km
    from public.profils p
    where p.dossier = 'VALIDE' and p.banni_le is null and (p.role = 'cleaneur' or 'cleaneur' = any (p.statuts))
      and p.zone_lat is not null and p.zone_lon is not null and p_lat is not null and p_lon is not null
      and p_rubrique = any (coalesce(p.prestations, '{}'))
      and public.km_entre(p.zone_lat, p.zone_lon, p_lat, p_lon) <= least(coalesce(p.zone_km, 20), 50))
  select c.id, c.prenom, left(coalesce(c.nom, ''), 1),
    (select round(avg(a.note)::numeric, 1) from public.avis a where a.cleaneur_id = c.id and public.avis_revele(a)),
    (select count(*)::int from public.avis a where a.cleaneur_id = c.id and public.avis_revele(a)),
    (select count(*)::int from public.demandes d where d.cleaneur_id = c.id and d.statut = 'TERMINEE'),
    coalesce((public.niveau_de(c.id)->>'niveau')::int, 0),
    public.formule_effective(c.id) = 'pro',
    coalesce(c.prestations, '{}'),
    -- Créneaux habituels par jour de la semaine (« 1 » = lundi … « 7 » = dimanche) : les 6 prochains jours ouverts sur 3 semaines,
    -- hors périodes fermées du Cleaneur.
    coalesce((select array_agg(j order by j) from (
       select g::date j from generate_series(current_date + 1, current_date + 20, interval '1 day') g
       where jsonb_typeof(c.disponibilites) = 'object'
         and jsonb_typeof(c.disponibilites -> extract(isodow from g)::int::text) = 'array'
         and jsonb_array_length(c.disponibilites -> extract(isodow from g)::int::text) > 0
         and not exists (select 1 from public.periodes_fermees f where f.cleaneur_id = c.id and g::date between f.debut and f.fin)
       order by 1 limit 6) x), '{}'),
    date_trunc('month', coalesce(c.valide_le, c.cree_le))::date,
    case when c.km < 5 then 5 when c.km < 10 then 10 when c.km < 20 then 20 when c.km < 30 then 30 else 50 end
  from c
  order by 4 desc nulls last, 6 desc, 1
  limit 30;
$$;

/* ---------------------------------------------------------------- 6. Rappel la veille */
create or replace function public.rappeler_missions() returns void language plpgsql security definer set search_path = '' as $$
declare d record; h text;
begin
  for d in select x.* from public.demandes x
     where x.statut = 'CONFIRMEE' and x.cleaneur_id is not null and x.creneau is not null
       and (x.creneau at time zone 'Europe/Paris')::date = (now() at time zone 'Europe/Paris')::date + 1
       and not exists (select 1 from public.notifications n where n.reference = x.reference and n.titre in ('Rappel : prestation demain', 'Rappel : mission demain')) loop
    h := to_char(d.creneau at time zone 'Europe/Paris', 'FMHH24" h "MI');
    if d.client_id is not null then
      perform public.notifier(d.client_id, 'client', 'mission', 'standard', 'Rappel : prestation demain',
        'Votre Cleaneur arrive demain à ' || h || '. Pensez à l''accès au logement.', d.reference);
    end if;
    perform public.notifier(d.cleaneur_id, 'cleaneur', 'mission', 'important', 'Rappel : mission demain',
      coalesce(d.ville, '') || ' à ' || h || '. Vérifiez l''accès et le matériel à prévoir.', d.reference);
  end loop;
end $$;
select cron.unschedule('rappel-missions') where exists (select 1 from cron.job where jobname = 'rappel-missions');
select cron.schedule('rappel-missions', '0 17 * * *', 'select public.rappeler_missions()');   -- 18 h à Paris l'hiver, 19 h l'été

revoke all on function public.infos_fil(text) from public, anon;
grant execute on function public.infos_fil(text) to authenticated;
revoke all on function public.reputation_cleaneur(uuid) from public;
grant execute on function public.reputation_cleaneur(uuid) to anon, authenticated;
revoke all on function public.rappeler_missions() from public, anon, authenticated;
