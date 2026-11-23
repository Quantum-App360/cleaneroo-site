-- Confiance et anti-contournement (version 1.0.69, 23 novembre 2026 — validé par Michael) :
-- 1. Vitrine des professionnels (logo, nom commercial, description) et photo d'identité des Cleaneurs (pièce du dossier).
-- 2. Plus aucune coordonnée échangée : téléphone du client et de la personne d'accueil retirés des missions, messagerie et vitrines
--    filtrées (numéros, e-mails, liens, réseaux, numéros écrits en lettres), tentatives enregistrées, avertissement puis alerte admin.
-- 3. Bouton « Je suis devant le logement / Je ne trouve pas l'accès » (prévient le client tout de suite).
-- 4. Commission dégressive avec un client fidèle : dès le 3e ménage terminé avec le même client, 9 % (Pro) et 15 % (Gratuit),
--    jamais cumulée avec « Inviter mon client » (le taux le plus avantageux s'applique) ; ne concerne pas les prix libres.
-- (Frais de sortie : écartés par Michael le 23/11/2026.)
-- 5. Détection : couples client–Cleaneur qui cessent de réserver alors que le Cleaneur reste actif ; tentatives de partage.

-- ------------------------------------------------------------------ 1. Vitrines et photo d'identité
alter table public.profils add column if not exists vitrine jsonb not null default '{}'::jsonb;

insert into storage.buckets (id, name, public) values ('vitrines', 'vitrines', true) on conflict (id) do nothing;
drop policy if exists "vitrines : déposer les siennes" on storage.objects;
create policy "vitrines : déposer les siennes" on storage.objects for insert to authenticated
  with check (bucket_id = 'vitrines' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "vitrines : remplacer les siennes" on storage.objects;
create policy "vitrines : remplacer les siennes" on storage.objects for update to authenticated
  using (bucket_id = 'vitrines' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "vitrines : retirer les siennes" on storage.objects;
create policy "vitrines : retirer les siennes" on storage.objects for delete to authenticated
  using (bucket_id = 'vitrines' and (storage.foldername(name))[1] = (select auth.uid())::text);

/** Le client connecté peut-il voir la photo d'identité de ce Cleaneur ? (sa mission, sa candidature ou son favori) */
create or replace function public.voit_photo_cleaneur(p_cleaneur uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and (
    exists (select 1 from public.demandes d where d.client_id = auth.uid() and d.statut <> 'ANNULEE'
            and (d.cleaneur_id = p_cleaneur or p_cleaneur = any (d.equipiers)))
    or exists (select 1 from public.propositions x join public.demandes d on d.reference = x.reference
               where d.client_id = auth.uid() and x.cleaneur_id = p_cleaneur)
    or exists (select 1 from public.favoris f where f.client_id = auth.uid() and f.cleaneur_id = p_cleaneur));
$$;
drop policy if exists "documents : photo d'identité vue par ses clients" on storage.objects;
create policy "documents : photo d'identité vue par ses clients" on storage.objects for select to authenticated
  using (bucket_id = 'documents-cleaneurs' and name like '%/photo_identite-%'
         and public.voit_photo_cleaneur(((storage.foldername(name))[1])::uuid));

/** Chemin de la photo d'identité acceptée d'un Cleaneur (pour ses clients, lui-même ou l'admin), sinon null. */
create or replace function public.photo_cleaneur(p_cleaneur uuid) returns text
language sql stable security definer set search_path = '' as $$
  select dc.chemin from public.documents_cleaneur dc
   where dc.cleaneur_id = p_cleaneur and dc.type = 'photo_identite' and dc.statut <> 'REFUSE'
     and (p_cleaneur = auth.uid() or public.est_admin() or (dc.statut = 'ACCEPTE' and public.voit_photo_cleaneur(p_cleaneur)))
   order by (dc.statut = 'ACCEPTE') desc, dc.cree_le desc limit 1;
$$;
grant execute on function public.photo_cleaneur(uuid) to authenticated;

-- La photo d'identité devient une pièce obligatoire du dossier.
do $$
declare f text := pg_get_functiondef('public.soumettre_dossier'::regproc);
begin
  if position('photo_identite' in f) = 0 then
    f := replace(f, 'and type in (''identite'', ''siret'', ''rc_pro'', ''urssaf'')) < 4 then return ''documents''; end if;',
      'and type in (''identite'', ''siret'', ''rc_pro'', ''urssaf'')) < 4 then return ''documents''; end if;'
      || E'\n  if not exists (select 1 from public.documents_cleaneur where cleaneur_id = p.id and type = ''photo_identite'' and statut <> ''REFUSE'') then return ''photo''; end if;');
    if position('photo_identite' in f) = 0 then raise exception 'soumettre_dossier : ligne introuvable'; end if;
    execute f;
  end if;
end $$;

-- ------------------------------------------------------------------ 2. Coordonnées masquées
/** Masque numéros, e-mails, liens, réseaux et numéros écrits en lettres. Les codes, prix et dates restent lisibles. */
create or replace function public.masquer_coordonnees(t text) returns text
language plpgsql immutable set search_path = '' as $$
declare r text := coalesce(t, ''); m constant text := '[coordonnées masquées]';
  mots constant text := '(z[ée]ro|un|deux|trois|quatre|cinq|six|sept|huit|neuf|dix|onze|douze|treize|quatorze|quinze|seize|vingt|trente|quarante|cinquante|soixante|cent)';
begin
  r := regexp_replace(r, '[A-Za-z0-9._%+-]+\s*(@|\(at\)|\[at\]|\s+arobase\s+)\s*[A-Za-z0-9-]+((\.|\s+point\s+)[A-Za-z0-9-]+)*(\.|\s+point\s+)[A-Za-z]{2,}', m, 'gi');
  r := regexp_replace(r, '(https?://\S+|www\.\S+|\m[a-z0-9-]+\.(fr|com|net|org|io|me|be|ch|eu|app|co|info|biz)\M\S*)', m, 'gi');
  r := regexp_replace(r, '\m(wa\.me|whats\s?app|watsap+|wtsp|telegram|insta(gram)?|snap(chat)?|facebook|messenger|tiktok|linkedin)\M(\s*[:@]?\s*@?[A-Za-z0-9._-]{3,})?', m, 'gi');
  r := regexp_replace(r, '(^|\s)@[A-Za-z0-9._]{3,}', '\1' || m, 'g');
  r := regexp_replace(r, '(\+|00)?\d([\s.()-]*\d){8,}', m, 'g');
  r := regexp_replace(r, '(' || mots || '[\s,.-]+){5,}' || mots, m, 'gi');
  return r;
end $$;

create table if not exists public.tentatives_contact (
  id uuid primary key default gen_random_uuid(),
  auteur uuid not null,
  fil text not null default '',
  extrait text not null default '',
  cree_le timestamptz not null default now());
alter table public.tentatives_contact enable row level security;
drop policy if exists "tentatives : admin lit" on public.tentatives_contact;
create policy "tentatives : admin lit" on public.tentatives_contact for select using ((select public.est_admin()));

/** Enregistre une tentative ; 2e en 30 jours : avertissement ; 4e et suivantes : alerte aux administrateurs. */
create or replace function public.noter_tentative(p_auteur uuid, p_fil text, p_extrait text, p_espace text) returns void
language plpgsql security definer set search_path = '' as $$
declare n integer; a record;
begin
  insert into public.tentatives_contact (auteur, fil, extrait) values (p_auteur, coalesce(p_fil, ''), left(coalesce(p_extrait, ''), 300));
  select count(*) into n from public.tentatives_contact where auteur = p_auteur and cree_le > now() - interval '30 days';
  begin
    if n = 2 then
      perform public.notifier(p_auteur, p_espace, 'alerte', 'important', 'Coordonnées masquées',
        'Partager un numéro, un e-mail ou un réseau social est contraire aux conditions d''utilisation : passez par Cleaneroo (messagerie, paiement protégé, assurance). En cas de récidive, le compte peut être suspendu.', p_fil);
    elsif n >= 4 then
      for a in select id from public.profils where role = 'admin' loop
        perform public.notifier(a.id, 'client', 'alerte', 'important', 'Contournement possible',
          'Tentatives répétées de partage de coordonnées (' || n || ' en 30 jours). Voir « Risques de contournement ».', p_fil);
      end loop;
    end if;
  exception when others then null; end;
end $$;
revoke all on function public.noter_tentative(uuid, text, text, text) from public, anon, authenticated;

do $$
declare f text := pg_get_functiondef('public.envoyer_message'::regproc);
begin
  if position('masquer_coordonnees' in f) = 0 then
    f := replace(f, 'declare r text := public.role_dans_fil(p_fil);', 'declare v_texte text; r text := public.role_dans_fil(p_fil);');
    f := replace(f, '  insert into public.messages (fil, auteur, role, texte, photo) values (p_fil, auth.uid(), r, left(trim(coalesce(p_texte, '''')), 2000), coalesce(p_photo, ''''));',
      E'  -- Coordonnées masquées (23/11/2026) : plus de passage en direct par la messagerie.\n'
      || E'  v_texte := public.masquer_coordonnees(left(trim(coalesce(p_texte, '''')), 2000));\n'
      || E'  if v_texte <> left(trim(coalesce(p_texte, '''')), 2000) and r <> ''support'' then\n'
      || E'    perform public.noter_tentative(auth.uid(), p_fil, p_texte, case when r = ''cleaneur'' then ''cleaneur'' else ''client'' end);\n'
      || E'  end if;\n'
      || E'  insert into public.messages (fil, auteur, role, texte, photo) values (p_fil, auth.uid(), r, v_texte, coalesce(p_photo, ''''));');
    if position('masquer_coordonnees' in f) = 0 then raise exception 'envoyer_message : ligne introuvable'; end if;
    execute f;
  end if;
  -- Le Cleaneur ne reçoit plus le téléphone du client ni celui de la personne d'accueil (seulement son nom).
  f := pg_get_functiondef('public.mes_missions'::regproc);
  if position('acces, ''{}''::jsonb) - ''telephone''' in f) = 0 then
    f := replace(f, 'd.prenom, d.telephone, d.accueil, d.remarque, coalesce(d.acces, ''{}''::jsonb),',
      'd.prenom, ''''::text, d.accueil, d.remarque, coalesce(d.acces, ''{}''::jsonb) - ''telephone'',');
    if position('- ''telephone''' in f) = 0 then raise exception 'mes_missions : ligne introuvable'; end if;
    execute f;
  end if;
end $$;

/** Vitrine d'un professionnel (conciergerie, hôtel, entreprise, société de nettoyage) : textes filtrés, logo dans « vitrines ». */
create or replace function public.enregistrer_vitrine(p_vitrine jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v jsonb; brut text;
begin
  if auth.uid() is null then return null; end if;
  brut := coalesce(p_vitrine->>'nom', '') || ' ' || coalesce(p_vitrine->>'description', '');
  v := jsonb_build_object(
    'nom', left(public.masquer_coordonnees(trim(coalesce(p_vitrine->>'nom', ''))), 80),
    'description', left(public.masquer_coordonnees(trim(coalesce(p_vitrine->>'description', ''))), 400),
    'ville', left(public.masquer_coordonnees(trim(coalesce(p_vitrine->>'ville', ''))), 60),
    'depuis', case when (p_vitrine->>'depuis') ~ '^(19|20)[0-9]{2}$' then (p_vitrine->>'depuis')::integer end,
    'effectif', left(public.masquer_coordonnees(trim(coalesce(p_vitrine->>'effectif', ''))), 40),
    'logo', case when coalesce(p_vitrine->>'logo', '') like auth.uid()::text || '/%' then p_vitrine->>'logo' else '' end,
    'maj_le', now());
  if (v->>'nom') || ' ' || (v->>'description') <> trim(coalesce(p_vitrine->>'nom', '')) || ' ' || trim(coalesce(p_vitrine->>'description', '')) then
    perform public.noter_tentative(auth.uid(), 'vitrine', brut, 'client');
  end if;
  update public.profils set vitrine = v where id = auth.uid();
  return v;
end $$;
grant execute on function public.enregistrer_vitrine(jsonb) to authenticated;

/** Vitrine publique d'un profil (sans aucune coordonnée) ; « verifie » : SIRET renseigné et, pour un Cleaneur, dossier validé. */
create or replace function public.vitrine_publique(p uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select case when x.id is null or coalesce(x.vitrine->>'nom', '') = '' then null else
    x.vitrine - 'maj_le' || jsonb_build_object('verifie', coalesce(nullif(x.siret_societe, ''), nullif(x.siret, '')) is not null
      and (x.role <> 'cleaneur' or x.dossier = 'VALIDE'),
      'note', (select round(avg(a.note)::numeric, 1) from public.avis a join public.demandes d on d.reference = a.reference
               where coalesce(d.societe_id, d.cleaneur_id) = x.id and a.note is not null)) end
  from (select * from public.profils where id = p) x;
$$;

/** Côté Cleaneur : chez qui il va (vitrine du client professionnel) — mission visible ou attribuée. */
create or replace function public.chez_qui(p_reference text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare d public.demandes;
begin
  select * into d from public.demandes where reference = p_reference;
  if d.id is null or d.espace = 'personnel' then return null; end if;
  if not (d.cleaneur_id = auth.uid() or auth.uid() = any (d.equipiers) or public.mission_visible(d)
          or exists (select 1 from public.profils me where me.id = auth.uid() and me.id = d.societe_id)) then return null; end if;
  return public.vitrine_publique(d.client_id);
end $$;
grant execute on function public.chez_qui(text) to authenticated;

/** Côté client : qui vient (prénom, photo d'identité, vitrine de la société de nettoyage le cas échéant). */
create or replace function public.qui_vient(p_reference text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare d public.demandes; c public.profils;
begin
  select * into d from public.demandes where reference = p_reference;
  if d.id is null or d.client_id is distinct from auth.uid() or d.cleaneur_id is null then return null; end if;
  select * into c from public.profils where id = d.cleaneur_id;
  return jsonb_build_object('cleaneur_id', c.id, 'prenom', c.prenom, 'photo', public.photo_cleaneur(c.id),
    'societe', public.vitrine_publique(coalesce(d.societe_id, c.employeur_id, c.id)));
end $$;
grant execute on function public.qui_vient(text) to authenticated;

-- ------------------------------------------------------------------ 3. « Je suis devant le logement / Je ne trouve pas l'accès »
create or replace function public.signaler_acces(p_reference text, p_type text) returns text
language plpgsql security definer set search_path = '' as $$
declare d public.demandes; t text;
begin
  select * into d from public.demandes where reference = p_reference;
  if d.id is null or not (d.cleaneur_id = auth.uid() or auth.uid() = any (d.equipiers)) then return 'interdit'; end if;
  if d.statut not in ('CONFIRMEE', 'EN_ROUTE', 'SUR_PLACE', 'EN_COURS') then return 'statut'; end if;
  t := case p_type when 'devant' then 'Je suis devant le logement.' when 'acces' then 'Je ne trouve pas l''accès : pouvez-vous m''indiquer comment entrer ?' else null end;
  if t is null then return 'type'; end if;
  perform public.envoyer_message(p_reference, t);
  begin
    perform public.notifier(d.client_id, 'client', 'alerte', 'important',
      case p_type when 'devant' then 'Votre Cleaneur est devant le logement' else 'Votre Cleaneur ne trouve pas l''accès' end,
      case p_type when 'devant' then 'Il arrive : vous n''avez rien à faire si l''accès est prévu.' else 'Répondez-lui dans la messagerie de la prestation.' end, p_reference);
  exception when others then null; end;
  return 'ok';
end $$;
grant execute on function public.signaler_acces(text, text) to authenticated;

-- ------------------------------------------------------------------ 4. Commission dégressive avec un client fidèle
do $$
declare f text := pg_get_functiondef('public.emettre_factures'::regproc);
begin
  if position('com_fid' in f) = 0 then
    f := replace(f, 'declare frais_b integer := 0;', 'declare com_fid integer; frais_b integer := 0;');
    f := replace(f, '  com_pb := case when public.formule_effective(payeur) = ''pro'' then 1200 else 2000 end;',
      '  com_pb := case when public.formule_effective(payeur) = ''pro'' then 1200 else 2000 end;'
      || E'\n  -- Client fidèle (23/11/2026) : dès le 3e ménage terminé avec ce client, 9 % (Pro) ou 15 % (Gratuit).'
      || E'\n  com_fid := case when (select count(*) from public.demandes x where x.client_id = d.client_id and x.id <> d.id and x.statut = ''TERMINEE'''
      || E'\n      and coalesce(x.societe_id, x.cleaneur_id) = payeur and coalesce(x.creneau, x.cree_le) <= coalesce(d.creneau, d.cree_le)) >= 2'
      || E'\n    then case when com_pb = 1200 then 900 else 1500 end else com_pb end;');
    f := replace(f, '  com := round(coalesce(d.estimation_initiale_c, d.estimation_c) * com_pb / 10000.0);',
      '  com_pb := least(com_pb, com_fid);   -- jamais cumulé avec « Inviter mon client » : le plus avantageux'
      || E'\n  com := round(coalesce(d.estimation_initiale_c, d.estimation_c) * com_pb / 10000.0);');
    if position('com_pb := least(com_pb, com_fid)' in f) = 0 or position('then case when com_pb = 1200 then 900' in f) = 0
       or position('declare com_fid integer;' in f) = 0 then raise exception 'emettre_factures : modification incomplète'; end if;
    execute f;
  end if;
end $$;

/** Taux de commission qui s'appliquera au prochain ménage avec ce client (pour l'afficher au Cleaneur), en points de base. */
create or replace function public.taux_fidelite(p_client uuid) returns integer
language sql stable security definer set search_path = '' as $$
  select case when (select count(*) from public.demandes x where x.client_id = p_client and x.statut = 'TERMINEE'
                    and coalesce(x.societe_id, x.cleaneur_id) = auth.uid()) >= 2
    then case when public.formule_effective(auth.uid()) = 'pro' then 900 else 1500 end
    else case when public.formule_effective(auth.uid()) = 'pro' then 1200 else 2000 end end;
$$;
grant execute on function public.taux_fidelite(uuid) to authenticated;

-- ------------------------------------------------------------------ 5. Détection (administrateur)
create or replace function public.risques_contournement() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.est_admin() then return null; end if;
  return jsonb_build_object(
    'couples', coalesce((select jsonb_agg(row_to_json(c) order by c.dernier desc) from (
      select x.client_id, coalesce(x.societe_id, x.cleaneur_id) cleaneur_id,
        max(cl.prenom) || ' ' || left(max(cl.nom), 1) || '.' client, max(cn.prenom) || ' ' || left(max(cn.nom), 1) || '.' cleaneur,
        count(*) menages, max(coalesce(x.creneau, x.cree_le)) dernier
      from public.demandes x join public.profils cl on cl.id = x.client_id join public.profils cn on cn.id = coalesce(x.societe_id, x.cleaneur_id)
      where x.statut = 'TERMINEE'
      group by x.client_id, coalesce(x.societe_id, x.cleaneur_id)
      having count(*) >= 2 and max(coalesce(x.creneau, x.cree_le)) between now() - interval '12 months' and now() - interval '30 days'
         and not exists (select 1 from public.demandes y where y.client_id = x.client_id and y.statut not in ('ANNULEE', 'TERMINEE'))
         and exists (select 1 from public.demandes z where coalesce(z.societe_id, z.cleaneur_id) = coalesce(x.societe_id, x.cleaneur_id)
                     and coalesce(z.creneau, z.cree_le) > now() - interval '30 days' and z.statut <> 'ANNULEE')) c), '[]'::jsonb),
    'tentatives', coalesce((select jsonb_agg(row_to_json(t) order by t.n desc) from (
      select tc.auteur, max(p.prenom) || ' ' || left(max(p.nom), 1) || '.' nom, max(p.role) role, count(*) n, max(tc.cree_le) derniere,
        (array_agg(tc.extrait order by tc.cree_le desc))[1] extrait
      from public.tentatives_contact tc join public.profils p on p.id = tc.auteur
      where tc.cree_le > now() - interval '90 days' group by tc.auteur) t), '[]'::jsonb));
end $$;
grant execute on function public.risques_contournement() to authenticated;
