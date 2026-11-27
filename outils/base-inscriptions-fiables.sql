-- Inscriptions fiables et pré-lancement (27/11/2026, validé par Michael : « Applique tout et mets en ligne »).
-- Cause de la panne : à l'inscription, le téléphone (non renseigné) et le SIRET de Cleaneur (vide hors société) arrivaient
-- NULL dans des colonnes obligatoires : le profil était refusé, donc toute l'inscription échouait.
-- 1. Correction : ces champs sont enregistrés vides ('').
-- 2. Profil de secours : si la création du profil échoue pour une autre raison, le compte est créé quand même (profil minimal),
--    l'erreur est gardée dans incidents_inscription et l'administrateur est notifié. Plus aucun inscrit perdu.
-- 3. Sentinelle : chaque heure, une inscription client et une inscription Cleaneur sont simulées puis annulées ; échec → alerte.
-- 4. tableau_prelancement() : inscriptions, dossiers des Cleaneurs, secteurs prêts à ouvrir, incidents (espace de gestion).

create table if not exists public.incidents_inscription (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  email text,
  erreur text not null,
  statuts text[],
  cree_le timestamptz not null default now(),
  resolu_le timestamptz);
alter table public.incidents_inscription enable row level security;
drop policy if exists "incidents : administrateur" on public.incidents_inscription;
create policy "incidents : administrateur" on public.incidents_inscription for all to authenticated using ((select public.est_admin())) with check ((select public.est_admin()));

create table if not exists public.sentinelle_inscriptions (
  id bigserial primary key,
  le timestamptz not null default now(),
  ok boolean not null,
  detail text);
alter table public.sentinelle_inscriptions enable row level security;
drop policy if exists "sentinelle : administrateur" on public.sentinelle_inscriptions;
create policy "sentinelle : administrateur" on public.sentinelle_inscriptions for select to authenticated using ((select public.est_admin()));

/** Alerte à tous les administrateurs (même canal que l'alerte sécurité). */
create or replace function public.alerter_admins(p_titre text, p_texte text) returns void language plpgsql security definer set search_path to '' as $$
declare a record;
begin
  for a in select p.id from public.profils p where p.role = 'admin' loop
    perform public.notifier(a.id, 'client', 'alerte', 'urgent', p_titre, p_texte, null);
  end loop;
end $$;
revoke all on function public.alerter_admins(text, text) from public, anon, authenticated;

create or replace function public.nouveau_profil() returns trigger language plpgsql security definer set search_path to '' as $$
declare m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb); st text[]; soc text := left(coalesce(m->>'societe', ''), 120);
  sir text := regexp_replace(coalesce(m->>'siret_societe', ''), '[^0-9]', '', 'g'); societe_ok boolean;
  sec text := nullif(coalesce(m->>'secteur', ''), '');
  civ text := nullif(coalesce(m->>'civilite', ''), ''); qual text := nullif(left(btrim(coalesce(m->>'qualite', '')), 60), '');
  tel text := left(regexp_replace(coalesce(m->>'telephone', ''), '[^0-9+ ]', '', 'g'), 20);
  societe_cleaneur boolean; err text;
begin
  if jsonb_typeof(m->'statuts') = 'array' then
    select coalesce(array_agg(distinct x), '{}') into st from jsonb_array_elements_text(m->'statuts') x where x in ('particulier', 'entreprise', 'pro', 'hotellerie', 'cleaneur');
  else st := array[case when m->>'role' = 'cleaneur' then 'cleaneur' when m->>'espace' = 'pro' then 'pro' else 'particulier' end]; end if;
  if st is null or cardinality(st) = 0 then st := '{particulier}'; end if;
  begin
    societe_ok := soc <> '' and public.siren_siret_valide(sir);
    societe_cleaneur := 'cleaneur' = any (st) and coalesce(m->>'type_cleaneur', '') = 'societe' and societe_ok;
    if not societe_ok then st := array_remove(array_remove(array_remove(st, 'pro'), 'entreprise'), 'hotellerie'); end if;
    if cardinality(st) = 0 then st := '{particulier}'; end if;
    if not (societe_cleaneur or 'pro' = any (st) or 'entreprise' = any (st) or 'hotellerie' = any (st)) then soc := ''; sir := ''; end if;
    if not ('entreprise' = any (st)) or sec not in ('bureaux', 'medical', 'commerce', 'restaurant', 'garage', 'funeraire', 'syndic', 'nautisme', 'loueur', 'evenementiel', 'btp', 'industrie', 'autre') then sec := null; end if;
    if civ not in ('madame', 'monsieur') then civ := null; end if;
    if not societe_cleaneur and not ('pro' = any (st) or 'entreprise' = any (st) or 'hotellerie' = any (st)) then qual := null; end if;
    insert into public.profils (id, role, prenom, nom, statuts, espace, societe, siret_societe, secteur, civilite, qualite, telephone, siret, societe_equipe)
    values (new.id, case when 'cleaneur' = any (st) then 'cleaneur' else 'client' end, left(coalesce(m->>'prenom', ''), 80), left(coalesce(m->>'nom', ''), 80), st,
      case when 'cleaneur' = any (st) then 'cleaneur' when 'pro' = any (st) then 'pro' when 'hotellerie' = any (st) then 'hotellerie' when 'entreprise' = any (st) then 'entreprise' else 'particulier' end,
      nullif(soc, ''), coalesce(sir, ''), sec, civ, qual, coalesce(tel, ''),
      coalesce(case when societe_cleaneur and length(sir) = 14 then sir end, ''),
      societe_cleaneur and coalesce(m->>'engagement_formation', '') = 'true') on conflict do nothing;
  exception when others then
    -- Profil de secours : le compte est créé quand même ; l'erreur est gardée et l'administrateur prévenu.
    err := sqlerrm;
    begin
      insert into public.profils (id, role, prenom, statuts, espace)
      values (new.id, case when 'cleaneur' = any (st) then 'cleaneur' else 'client' end, left(coalesce(m->>'prenom', ''), 80),
        case when 'cleaneur' = any (st) then '{cleaneur}'::text[] else '{particulier}'::text[] end,
        case when 'cleaneur' = any (st) then 'cleaneur' else 'particulier' end) on conflict do nothing;
    exception when others then err := err || ' | profil minimal : ' || sqlerrm; end;
    begin
      insert into public.incidents_inscription (user_id, email, erreur, statuts) values (new.id, new.email, left(err, 1000), st);
      perform public.alerter_admins('Incident d''inscription', left('Un compte a été créé avec un profil minimal : ' || err, 400));
    exception when others then null; end;
  end;
  begin
    if coalesce(m->>'code_parrain', '') <> '' then perform public.lier_parrain(new.id, m->>'code_parrain'); end if;
  exception when others then null; end;
  return new;
end $$;

/** Sentinelle : une inscription client et une inscription Cleaneur simulées puis annulées. Échec → alerte (au plus toutes les 6 h). */
create or replace function public.sentinelle_inscription() returns boolean language plpgsql security definer set search_path to '' as $$
declare ok boolean := true; detail text := ''; t record; u uuid; r text;
begin
  for t in select * from (values ('client', '{"prenom":"Sentinelle","statuts":["particulier"]}'::jsonb),
                                 ('cleaneur', '{"prenom":"Sentinelle","statuts":["cleaneur"]}'::jsonb)) v(nom, meta) loop
    begin
      u := gen_random_uuid();
      insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
      values (u, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sentinelle-' || u || '@cleaneroo.invalid', t.meta, now(), now());
      if not exists (select 1 from public.profils where id = u) then raise exception 'SENTINELLE:pas de profil'; end if;
      if exists (select 1 from public.incidents_inscription where user_id = u) then
        raise exception 'SENTINELLE:%', (select erreur from public.incidents_inscription where user_id = u limit 1);
      end if;
      raise exception 'SENTINELLE:ok';   -- annule l'inscription simulée
    exception when others then
      r := sqlerrm;
      if r <> 'SENTINELLE:ok' then ok := false; detail := detail || t.nom || ' : ' || replace(r, 'SENTINELLE:', '') || ' '; end if;
    end;
  end loop;
  insert into public.sentinelle_inscriptions (ok, detail) values (ok, nullif(trim(detail), ''));
  delete from public.sentinelle_inscriptions where le < now() - interval '30 days';
  if not ok and not exists (select 1 from public.notifications n join public.profils p on p.id = n.destinataire and p.role = 'admin'
                             where n.titre = 'Inscriptions en panne' and n.cree_le > now() - interval '6 hours') then
    perform public.alerter_admins('Inscriptions en panne', left('La sentinelle n''arrive pas à créer un compte : ' || detail, 400));
  end if;
  return ok;
end $$;
revoke all on function public.sentinelle_inscription() from public, anon, authenticated;

select cron.unschedule('sentinelle-inscriptions') where exists (select 1 from cron.job where jobname = 'sentinelle-inscriptions');
select cron.schedule('sentinelle-inscriptions', '7 * * * *', 'select public.sentinelle_inscription()');

/** Tableau « Pré-lancement » (administrateur). */
create or replace function public.tableau_prelancement() returns jsonb language plpgsql stable security definer set search_path to '' as $$
declare r jsonb;
begin
  if not public.est_admin() then raise exception 'interdit'; end if;
  with p as (select pr.*, case when 'cleaneur' = any (pr.statuts) then 'cleaneur' else pr.espace end as cat
               from public.profils pr where pr.role <> 'admin'),
  jours as (select d::date j from generate_series((now() at time zone 'Europe/Paris')::date - 29, (now() at time zone 'Europe/Paris')::date, interval '1 day') d),
  zones as (
    select lower(coalesce(nullif(a.ville, ''), '?')) cle, min(a.ville) ville, avg(a.lat) lat, avg(a.lon) lon, count(*) attente
      from public.attente_secteur a where a.reprise_le is null group by 1
    union all
    select lower(pr.ville), min(pr.ville), null, null, 0 from p pr where pr.cat <> 'cleaneur' and coalesce(pr.ville, '') <> '' group by 1),
  secteurs as (
    select z.cle, min(z.ville) ville, sum(z.attente) attente, avg(z.lat) lat, avg(z.lon) lon,
      (select count(*) from p pr where pr.cat <> 'cleaneur' and lower(pr.ville) = z.cle) clients
      from zones z group by z.cle)
  select jsonb_build_object(
    'totaux', (select jsonb_object_agg(cat, n) from (select cat, count(*) n from p group by cat) x),
    'jours', (select jsonb_agg(jsonb_build_object('jour', j.j,
               'clients', (select count(*) from p where p.cat <> 'cleaneur' and (p.cree_le at time zone 'Europe/Paris')::date = j.j),
               'cleaneurs', (select count(*) from p where p.cat = 'cleaneur' and (p.cree_le at time zone 'Europe/Paris')::date = j.j)) order by j.j) from jours j),
    'dossiers', (select jsonb_object_agg(coalesce(dossier, 'BROUILLON'), n) from (select dossier, count(*) n from p where p.cat = 'cleaneur' group by dossier) x),
    'secteurs', (select coalesce(jsonb_agg(jsonb_build_object('ville', s.ville, 'clients', s.clients, 'attente', s.attente,
                   'valides', case when s.lat is null then null else (select count(*) from p c where c.cat = 'cleaneur' and c.dossier = 'VALIDE' and c.banni_le is null and c.zone_lat is not null
                                and public.km_entre(c.zone_lat, c.zone_lon, s.lat, s.lon) <= least(coalesce(c.zone_km, 20), 50)) end,
                   'en_cours', case when s.lat is null then null else (select count(*) from p c where c.cat = 'cleaneur' and coalesce(c.dossier, 'BROUILLON') <> 'VALIDE' and c.zone_lat is not null
                                and public.km_entre(c.zone_lat, c.zone_lon, s.lat, s.lon) <= least(coalesce(c.zone_km, 20), 50)) end)
                 order by s.attente desc, s.clients desc), '[]'::jsonb) from (select * from secteurs order by attente desc, clients desc limit 40) s),
    'incidents', (select coalesce(jsonb_agg(jsonb_build_object('id', i.id, 'email', i.email, 'erreur', i.erreur, 'le', i.cree_le) order by i.cree_le desc), '[]'::jsonb)
                    from (select * from public.incidents_inscription where resolu_le is null order by cree_le desc limit 20) i),
    'sentinelle', (select jsonb_build_object('le', s.le, 'ok', s.ok, 'detail', s.detail) from public.sentinelle_inscriptions s order by s.le desc limit 1)
  ) into r;
  return r;
end $$;
grant execute on function public.tableau_prelancement() to authenticated;

create or replace function public.incident_resolu(p_id uuid) returns void language sql security definer set search_path to '' as $$
  update public.incidents_inscription set resolu_le = now() where id = p_id and public.est_admin();
$$;
grant execute on function public.incident_resolu(uuid) to authenticated;
