-- Conciergeries : prix libres, baromètre et commission (document « Conciergeries : prix, baromètre et commission », version 2
-- du 23 novembre 2026, décisions de l'utilisateur : montage B activé, 5 % avec minimum 1,50 €, plancher 80 %, seuil 20 ménages / 90 jours).
--
-- • La conciergerie (ou l'hôtel, le camping) fixe le prix du ménage de location de chaque logement (biens.donnees.prixMenageC).
-- • Montage B, « comme les frais voyageur Airbnb » : le Cleaneur facture son montant NET ; Cleaneroo facture ses frais à la conciergerie.
--   Frais Cleaneroo : 5 % (minimum 1,50 €) si le Cleaneur a été apporté par cette conciergerie, sinon 12 % (Cleaneur Pro) ou 20 % (Gratuit).
--   Le Cleaneur ne voit que ce qu'il reçoit ; la conciergerie voit le détail. Frais de service de la conciergerie inchangés (8 %, 0 % abonnée).
-- • Anti-contournement : seul un Cleaneur NOUVEAU sur Cleaneroo (inscrit après l'invitation, jamais venu chez elle par le réseau)
--   est rattaché à la conciergerie qui l'invite.
-- • Plancher : sous 80 % du prix conseillé Cleaneroo, la mission n'est proposée qu'aux Cleaneurs rattachés à la conciergerie.
-- • Baromètre : moyenne et fourchette des prix ACCEPTÉS dans la zone (même ville ou code postal, même nombre de chambres, samedi à part),
--   seulement à partir de 20 ménages comparables sur 90 jours ; sinon le site et l'appli affichent le prix conseillé Cleaneroo.
-- • Relance : personne n'a accepté après 6 h (ou à moins de 48 h du ménage) → la conciergerie est invitée à augmenter le prix.

-- ------------------------------------------------------------------ Colonnes
alter table public.demandes add column if not exists prix_libre boolean not null default false;
alter table public.demandes add column if not exists conseil_c integer;          -- prix conseillé Cleaneroo (grille) au moment de la réservation
alter table public.demandes add column if not exists relance_le timestamptz;     -- conciergerie invitée à augmenter le prix
alter table public.invitations_pro add column if not exists rattache boolean not null default false;

-- Invitations déjà actives : rattachées si le Cleaneur s'est inscrit après l'invitation.
update public.invitations_pro i set rattache = true
 where i.statut = 'ACTIF' and not i.rattache and i.cleaneur_id is not null
   and exists (select 1 from public.profils p where p.id = i.cleaneur_id and p.cree_le >= i.envoyee_le - interval '1 day');

alter table public.factures drop constraint if exists factures_type_check;
alter table public.factures add constraint factures_type_check check (type in ('prestation', 'frais', 'commission', 'frais_cleaneroo'));

-- ------------------------------------------------------------------ Prix libre d'une demande
create or replace function public.demande_prix_libre() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.prix_libre := coalesce(new.details->>'prixLibre', '') = 'true' and new.espace in ('conciergerie', 'hotellerie') and new.rubrique_id = 'rental';
  if tg_op = 'INSERT' then new.relance_le := null; end if;
  if new.prix_libre and new.conseil_c is null and coalesce(new.details->>'prixConseilleC', '') ~ '^[0-9]+$' then
    new.conseil_c := (new.details->>'prixConseilleC')::integer;
  end if;
  return new;
end $$;
drop trigger if exists demande_prix_libre on public.demandes;
create trigger demande_prix_libre before insert or update of details, espace, rubrique_id on public.demandes
  for each row execute function public.demande_prix_libre();

-- ------------------------------------------------------------------ Rattachement et frais Cleaneroo
create or replace function public.rattache(p_cleaneur uuid, p_client uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_cleaneur is not null and exists (select 1 from public.invitations_pro i
    where i.cleaneur_id = p_cleaneur and i.pro_id = p_client and i.statut = 'ACTIF' and i.rattache);
$$;

/** Frais Cleaneroo d'un ménage à prix libre pour un Cleaneur donné (centimes), null hors prix libre. */
create or replace function public.frais_cleaneroo_c(d public.demandes, p_cleaneur uuid) returns integer
language sql stable security definer set search_path = '' as $$
  select case when not d.prix_libre then null
    when public.rattache(p_cleaneur, d.client_id) then least(d.estimation_c, greatest(150, round(d.estimation_c * 0.05)::integer))
    else round(d.estimation_c * case when public.formule_effective(coalesce(d.societe_id, p_cleaneur)) = 'pro' then 0.12 else 0.20 end)::integer end;
$$;

/** Ce que reçoit le Cleaneur : le net en prix libre, sinon le prix de la prestation (commission prélevée ensuite, comme avant). */
create or replace function public.net_cleaneur_c(d public.demandes, p_cleaneur uuid) returns integer
language sql stable security definer set search_path = '' as $$
  select case when d.prix_libre then d.estimation_c - coalesce(public.frais_cleaneroo_c(d, p_cleaneur), 0) else d.estimation_c end;
$$;

-- Le Cleaneur ne voit que son montant net (missions disponibles, mes missions, comptes rendus).
do $$
declare f text;
begin
  f := pg_get_functiondef('public.missions_disponibles'::regproc);
  if position('net_cleaneur_c' in f) = 0 then
    f := replace(f, 'd.duree_min, d.nombre_cleaneurs, d.estimation_c, d.sur_devis', 'd.duree_min, d.nombre_cleaneurs, public.net_cleaneur_c(d, auth.uid()), d.sur_devis');
    if position('net_cleaneur_c' in f) = 0 then raise exception 'missions_disponibles : colonne du prix introuvable'; end if;
    execute f;
  end if;
  f := pg_get_functiondef('public.mes_missions'::regproc);
  if position('net_cleaneur_c' in f) = 0 then
    f := replace(f, 'then 0 else d.estimation_c end', 'then 0 else public.net_cleaneur_c(d, auth.uid()) end');
    if position('net_cleaneur_c' in f) = 0 then raise exception 'mes_missions : colonne du prix introuvable'; end if;
    execute f;
  end if;
  f := pg_get_functiondef('public.mes_comptes_rendus'::regproc);
  if position('net_cleaneur_c' in f) = 0 then
    f := replace(f, 'then 0 else d.estimation_c end', 'then 0 else public.net_cleaneur_c(d, auth.uid()) end');
    if position('net_cleaneur_c' in f) = 0 then raise exception 'mes_comptes_rendus : colonne du prix introuvable'; end if;
    execute f;
  end if;
  -- Plancher : sous 80 % du prix conseillé, seuls les Cleaneurs rattachés à la conciergerie voient la mission.
  f := pg_get_functiondef('public.mission_visible'::regproc);
  if position('conseil_c' in f) = 0 then
    f := replace(f, 'or (public.paiement_garanti(d)',
      'or ((not d.prix_libre or d.conseil_c is null or d.estimation_c * 10 >= d.conseil_c * 8 or public.rattache(auth.uid(), d.client_id)) and public.paiement_garanti(d)');
    if position('conseil_c' in f) = 0 then raise exception 'mission_visible : début introuvable'; end if;
    execute f;
  end if;
  -- Anti-contournement : rattaché seulement s'il est nouveau sur Cleaneroo et jamais venu chez cette conciergerie par le réseau.
  f := pg_get_functiondef('public.utiliser_invitation'::regproc);
  if position('rattache' in f) = 0 then
    f := replace(f, 'statut = case when coalesce(v_valide, false) then ''ACTIF'' else ''DOSSIER'' end,',
      'statut = case when coalesce(v_valide, false) then ''ACTIF'' else ''DOSSIER'' end,'
      || E'\n    rattache = exists (select 1 from public.profils p where p.id = auth.uid() and p.cree_le >= i.envoyee_le - interval ''1 day'')'
      || E'\n      and not exists (select 1 from public.demandes x where x.client_id = i.pro_id and x.cleaneur_id = auth.uid() and x.statut = ''TERMINEE''),');
    if position('rattache' in f) = 0 then raise exception 'utiliser_invitation : mise à jour introuvable'; end if;
    execute f;
  end if;
end $$;

-- ------------------------------------------------------------------ Factures (montage B)
-- Prix libre : le Cleaneur facture son net à la conciergerie (mandat de facturation) ; Cleaneroo facture ses frais (TVA comprise)
-- à la conciergerie ; pas de facture de commission au Cleaneur. Les autres prestations ne changent pas.
do $$
declare f text := pg_get_functiondef('public.emettre_factures'::regproc);
begin
  if position('frais_b' in f) = 0 then
    f := replace(f, 'declare d public.demandes;', 'declare frais_b integer := 0; d public.demandes;');
    f := replace(f, '  presta := d.estimation_c - dep;',
      E'  -- Montage B (prix libre des conciergeries, 23/11/2026) : la facture du Cleaneur porte son montant net.\n'
      || E'  frais_b := case when d.prix_libre then coalesce(public.frais_cleaneroo_c(d, d.cleaneur_id), 0) else 0 end;\n'
      || E'  presta := d.estimation_c - dep - frais_b;');
    f := replace(f, 'dest, d.client_id, payeur, d.espace, lignes, d.estimation_c, 0, d.estimation_c, '''', det);',
      'dest, d.client_id, payeur, d.espace, lignes, d.estimation_c - frais_b, 0, d.estimation_c - frais_b, '''', det);');
    f := replace(f, '  if com > 0 and not exists (select 1 from public.factures where reference = d.reference and type = ''commission'') then',
      '  if not d.prix_libre and com > 0 and not exists (select 1 from public.factures where reference = d.reference and type = ''commission'') then');
    f := replace(f, E'  end if;\nend ',
      E'  end if;\n'
      || E'  if d.prix_libre and frais_b > 0 and not exists (select 1 from public.factures where reference = d.reference and type = ''frais_cleaneroo'') then\n'
      || E'    insert into public.factures (numero, type, reference, emetteur, destinataire, client_id, cleaneur_id, espace, lignes, total_ht_c, tva_c, total_ttc_c, details)\n'
      || E'    values (public.prochain_numero(''CLN-'' || an), ''frais_cleaneroo'', d.reference, e_cleaneroo, dest, d.client_id, payeur, d.espace,\n'
      || E'      jsonb_build_array(jsonb_build_object(''libelle'', ''Frais Cleaneroo (mise en relation et paiement protégé) · prestation '' || d.reference, ''quantite'', 1, ''prix_ht_c'', round(frais_b / (1 + tva / 100)), ''tva_pct'', tva)),\n'
      || E'      round(frais_b / (1 + tva / 100)), frais_b - round(frais_b / (1 + tva / 100)), frais_b,\n'
      || E'      jsonb_build_object(''categorie'', ''PS'', ''categorie_libelle'', ''Prestation de services'', ''date_prestation'', det->>''date_prestation''));\n'
      || E'  end if;\nend ');
    if position('frais_b > 0' in f) = 0 or position('d.estimation_c - frais_b, 0, d.estimation_c - frais_b' in f) = 0
       or position('if not d.prix_libre and com > 0' in f) = 0 or position('presta := d.estimation_c - dep - frais_b' in f) = 0 then
      raise exception 'emettre_factures : modification incomplète';
    end if;
    execute f;
  end if;
end $$;

-- ------------------------------------------------------------------ Baromètre de prix
create or replace function public.barometre_prix(p_ville text, p_code_postal text, p_chambres integer, p_samedi boolean) returns jsonb
language sql stable security definer set search_path = '' as $$
  with x as (
    select d.estimation_c c from public.demandes d
    where auth.uid() is not null and d.prix_libre and d.rubrique_id = 'rental' and d.cleaneur_id is not null
      and d.statut in ('CONFIRMEE', 'EN_ROUTE', 'SUR_PLACE', 'EN_COURS', 'A_VALIDER', 'TERMINEE')
      and d.creneau > now() - interval '90 days'
      and (lower(trim(d.ville)) = lower(trim(coalesce(p_ville, ''))) or (coalesce(p_code_postal, '') <> '' and d.code_postal = p_code_postal))
      and coalesce(case when (d.details->>'chambres') ~ '^[0-9]+$' then (d.details->>'chambres')::integer end, -1) = coalesce(p_chambres, -1)
      and (extract(isodow from d.creneau at time zone 'Europe/Paris') = 6) = coalesce(p_samedi, false))
  select jsonb_build_object('n', count(*),
    'moyenne_c', case when count(*) >= 20 then round(avg(c))::integer end,
    'bas_c', case when count(*) >= 20 then round(percentile_cont(0.25) within group (order by c))::integer end,
    'haut_c', case when count(*) >= 20 then round(percentile_cont(0.75) within group (order by c))::integer end)
  from x;
$$;
revoke all on function public.barometre_prix(text, text, integer, boolean) from public, anon;
grant execute on function public.barometre_prix(text, text, integer, boolean) to authenticated;

-- ------------------------------------------------------------------ Relance et hausse du prix
-- La conciergerie relève le prix d'une demande encore sans Cleaneur (jamais à la baisse, au plus le double).
-- Le complément éventuel est prélevé à la validation, comme un supplément (fonction paiement, action « liberer »).
create or replace function public.augmenter_prix(p_reference text, p_prix_c integer) returns text
language plpgsql security definer set search_path = '' as $$
declare d public.demandes; pct numeric;
begin
  select * into d from public.demandes where reference = p_reference;
  if d.id is null or d.client_id is distinct from auth.uid() then return 'interdit'; end if;
  if not d.prix_libre or d.statut not in ('VERIFICATION', 'PUBLIEE') or d.cleaneur_id is not null then return 'statut'; end if;
  if p_prix_c is null or p_prix_c <= d.estimation_c or p_prix_c > d.estimation_c * 2 then return 'montant'; end if;
  pct := coalesce(nullif(d.details->>'fraisServicePctServeur', ''), nullif(d.details->>'fraisServicePct', ''), '8')::numeric;
  update public.demandes set estimation_c = p_prix_c,
    details = details || jsonb_build_object('fraisServiceC', round(p_prix_c * pct / 100), 'prixAugmenteLe', now(), 'prixAvantHausseC', d.estimation_c)
   where id = d.id;
  return 'ok';
end $$;
revoke all on function public.augmenter_prix(text, integer) from public, anon;
grant execute on function public.augmenter_prix(text, integer) to authenticated;

create or replace function public.relancer_prix_bas() returns integer
language plpgsql security definer set search_path = '' as $$
declare d record; b jsonb; cible integer; n integer := 0;
begin
  for d in select * from public.demandes x
            where x.prix_libre and x.statut = 'PUBLIEE' and x.cleaneur_id is null and x.relance_le is null
              and (x.cree_le < now() - interval '6 hours' or (x.creneau is not null and x.creneau < now() + interval '48 hours'))
              and (x.creneau is null or x.creneau > now()) loop
    select public.barometre_prix(d.ville, d.code_postal,
      case when (d.details->>'chambres') ~ '^[0-9]+$' then (d.details->>'chambres')::integer end,
      extract(isodow from d.creneau at time zone 'Europe/Paris') = 6) into b;
    cible := greatest(d.estimation_c + 200, coalesce((b->>'moyenne_c')::integer, d.conseil_c, d.estimation_c + 400));
    update public.demandes set relance_le = now(), details = details || jsonb_build_object('prixRelanceC', cible) where id = d.id;
    begin
      perform public.notifier(d.client_id, 'client', 'prix', 'important', 'Personne n''a encore accepté ce ménage',
        'Ménage du ' || coalesce(to_char(d.creneau at time zone 'Europe/Paris', 'DD/MM'), '?') || ' à ' || d.ville || ' : passez à '
        || replace(to_char(cible / 100.0, 'FM999990.00'), '.', ',') || ' € pour le confier plus vite. Ouvrez la demande pour ajuster le prix.', d.reference);
    exception when others then null; end;
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function public.relancer_prix_bas() from public, anon, authenticated;

select cron.unschedule('relance-prix') where exists (select 1 from cron.job where jobname = 'relance-prix');
select cron.schedule('relance-prix', '*/30 * * * *', 'select public.relancer_prix_bas()');

-- ------------------------------------------------------------------ Détail du prix pour la conciergerie (appliqué le 23/11/2026)
create or replace function public.detail_prix_libre(p_reference text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare d public.demandes; f integer; tva numeric; fs integer; rel integer;
begin
  select * into d from public.demandes where reference = p_reference;
  if d.id is null or d.client_id is distinct from auth.uid() or not d.prix_libre then return null; end if;
  select coalesce(nullif(valeur, ''), '20')::numeric into tva from public.infos_cleaneroo where cle = 'tva_frais_pct';
  tva := coalesce(tva, 20);
  fs := coalesce((d.details->>'fraisServiceC')::integer, 0);
  rel := case when (d.details->>'prixRelanceC') ~ '^[0-9]+$' then (d.details->>'prixRelanceC')::integer end;
  if d.cleaneur_id is not null then
    f := coalesce(public.frais_cleaneroo_c(d, d.cleaneur_id), 0);
    return jsonb_build_object('prix_c', d.estimation_c, 'conseil_c', d.conseil_c, 'frais_cleaneroo_c', f,
      'tva_frais_c', f - round(f / (1 + tva / 100)), 'net_cleaneur_c', d.estimation_c - f, 'frais_service_c', fs,
      'total_c', d.estimation_c + fs, 'rattache', public.rattache(d.cleaneur_id, d.client_id), 'relance_le', d.relance_le, 'prix_relance_c', rel);
  end if;
  return jsonb_build_object('prix_c', d.estimation_c, 'conseil_c', d.conseil_c, 'frais_service_c', fs, 'total_c', d.estimation_c + fs,
    'net_min_c', round(d.estimation_c * 0.80), 'net_max_c', d.estimation_c - least(d.estimation_c, greatest(150, round(d.estimation_c * 0.05)::integer)),
    'sous_plancher', d.conseil_c is not null and d.estimation_c * 10 < d.conseil_c * 8,
    'peut_augmenter', d.statut in ('VERIFICATION', 'PUBLIEE'), 'relance_le', d.relance_le, 'prix_relance_c', rel);
end $$;
revoke all on function public.detail_prix_libre(text) from public, anon;
grant execute on function public.detail_prix_libre(text) to authenticated;
