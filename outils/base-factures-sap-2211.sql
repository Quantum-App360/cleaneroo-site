-- 22/11/2026 : mentions des factures de services à la personne (art. D7233-1 du Code du travail), de l'attestation fiscale
-- annuelle (art. D7233-4) et nouvelles mentions de la facturation électronique (SIREN client, catégorie de l'opération).
-- Ajoute 3 champs au profil (adresse, numéro et date de déclaration SAP du Cleaneur) et une colonne « details » aux factures.
-- Ne supprime ni ne modifie aucune donnée existante.

alter table public.profils add column if not exists adresse text, add column if not exists sap_numero text, add column if not exists sap_date date;
grant select (adresse, sap_numero, sap_date) on public.profils to authenticated;
grant update (adresse, sap_numero, sap_date) on public.profils to authenticated;
alter table public.factures add column if not exists details jsonb not null default '{}'::jsonb;

create or replace function public.emettre_factures(p_reference text)
 returns void language plpgsql security definer set search_path to ''
as $function$
declare d public.demandes; c public.profils; cl public.profils; i public.profils; an text; info jsonb; tva numeric; frais integer; com_pb integer; com integer; dest jsonb; nom_r text; e_cleaneroo jsonb;
  payeur uuid; emet jsonb; dep integer; presta integer; sap boolean; det jsonb; mention_sap text; lignes jsonb; quand text;
begin
  select * into d from public.demandes where reference = p_reference;
  if d.id is null or d.statut <> 'TERMINEE' or d.cleaneur_id is null then return; end if;
  payeur := coalesce(d.societe_id, d.cleaneur_id);
  select * into c from public.profils where id = payeur;
  select * into i from public.profils where id = d.cleaneur_id;   -- intervenant (le Cleaneur, ou le salarié d'une société)
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
    'adresse', d.rue || ', ' || d.code_postal || ' ' || d.ville, 'code_postal', d.code_postal, 'ville', d.ville, 'email', d.email);
  emet := jsonb_build_object('nom', case when d.societe_id is not null and coalesce(c.societe, '') <> '' then c.societe else trim(c.prenom || ' ' || c.nom) end,
    'siret', case when d.societe_id is not null then coalesce(nullif(c.siret_societe, ''), c.siret) else c.siret end,
    'adresse', trim(both ', ' from coalesce(nullif(trim(c.adresse), '') || ', ', '') || trim(coalesce(c.code_postal, '') || ' ' || coalesce(c.ville, ''))),
    'code_postal', coalesce(c.code_postal, ''), 'ville', coalesce(c.ville, ''));
  -- Prestataire déclaré « services à la personne » : récépissé accepté et numéro de déclaration renseigné.
  sap := coalesce(c.sap_numero, '') <> '' and exists (select 1 from public.documents_cleaneur dc where dc.cleaneur_id = payeur and dc.type = 'sap' and dc.statut = 'ACCEPTE');
  dep := least(coalesce((d.etapes->>'frais_deplacement_c')::integer, 0), d.estimation_c);
  presta := d.estimation_c - dep;
  quand := to_char(coalesce(d.creneau, now()) at time zone 'Europe/Paris', 'DD/MM/YYYY');
  det := jsonb_build_object('categorie', 'PS', 'categorie_libelle', 'Prestation de services',
    'date_prestation', to_char(coalesce(d.creneau, now()) at time zone 'Europe/Paris', 'YYYY-MM-DD'),
    'adresse_prestation', d.rue || ', ' || d.code_postal || ' ' || d.ville,
    'duree_min', coalesce(d.duree_min, 0), 'nature', nom_r, 'prix_forfaitaire', true,
    'taux_horaire_c', case when coalesce(d.duree_min, 0) > 0 then round(presta * 60.0 / d.duree_min) else null end,
    'intervenant', jsonb_build_object('nom', trim(coalesce(i.prenom, '') || ' ' || left(coalesce(i.nom, ''), 1) || '.'), 'code', 'INT-' || upper(substr(replace(d.cleaneur_id::text, '-', ''), 1, 8))),
    'frais_deplacement_c', dep, 'sap', sap);
  if d.espace = 'personnel' then
    mention_sap := case when sap then 'Prestataire déclaré « services à la personne » : déclaration n° ' || c.sap_numero || coalesce(' du ' || to_char(c.sap_date, 'DD/MM/YYYY'), '')
        || '. Prestation de services à la personne réalisée au domicile, ouvrant droit au crédit d''impôt de l''article 199 sexdecies du CGI (selon votre situation).'
      else 'Prestataire non déclaré « services à la personne » : cette prestation n''ouvre pas droit au crédit d''impôt de l''article 199 sexdecies du CGI.' end;
    emet := emet || jsonb_build_object('sap_numero', coalesce(c.sap_numero, ''), 'sap_date', coalesce(to_char(c.sap_date, 'DD/MM/YYYY'), ''), 'mention_sap', mention_sap);
  end if;
  lignes := jsonb_build_array(jsonb_build_object('libelle', nom_r || ' · ' || quand || ' · ' || d.ville || ' · prix forfaitaire'
      || case when coalesce(d.duree_min, 0) > 0 then ', durée ' || (d.duree_min / 60) || ' h ' || lpad((d.duree_min % 60)::text, 2, '0') else '' end,
    'quantite', 1, 'prix_ht_c', presta, 'tva_pct', 0));
  if dep > 0 then lignes := lignes || jsonb_build_array(jsonb_build_object('libelle', 'Frais de déplacement', 'quantite', 1, 'prix_ht_c', dep, 'tva_pct', 0)); end if;
  if not exists (select 1 from public.factures where reference = d.reference and type = 'prestation') then
    insert into public.factures (numero, type, reference, emetteur, destinataire, client_id, cleaneur_id, espace, lignes, total_ht_c, tva_c, total_ttc_c, description, details)
    values (public.prochain_numero('C' || upper(substr(replace(payeur::text, '-', ''), 1, 6)) || '-' || an), 'prestation', d.reference,
      emet || jsonb_build_object('mention_tva', 'TVA non applicable, art. 293 B du CGI', 'mandat', 'Facture établie par Cleaneroo au nom et pour le compte du prestataire (mandat de facturation).'),
      dest, d.client_id, payeur, d.espace, lignes, d.estimation_c, 0, d.estimation_c, '', det);
  end if;
  frais := coalesce((d.details->>'fraisServiceC')::integer, 0);
  if frais > 0 and not exists (select 1 from public.factures where reference = d.reference and type = 'frais') then
    insert into public.factures (numero, type, reference, emetteur, destinataire, client_id, cleaneur_id, espace, lignes, total_ht_c, tva_c, total_ttc_c, details)
    values (public.prochain_numero('CLN-' || an), 'frais', d.reference, e_cleaneroo, dest, d.client_id, payeur, d.espace,
      jsonb_build_array(jsonb_build_object('libelle', 'Frais de service Cleaneroo · prestation ' || d.reference, 'quantite', 1, 'prix_ht_c', round(frais / (1 + tva / 100)), 'tva_pct', tva)),
      round(frais / (1 + tva / 100)), frais - round(frais / (1 + tva / 100)), frais,
      jsonb_build_object('categorie', 'PS', 'categorie_libelle', 'Prestation de services', 'date_prestation', det->>'date_prestation'));
  end if;
  com_pb := case when public.formule_effective(payeur) = 'pro' then 1200 else 2000 end;
  com := round(coalesce(d.estimation_initiale_c, d.estimation_c) * com_pb / 10000.0);
  if com > 0 and not exists (select 1 from public.factures where reference = d.reference and type = 'commission') then
    insert into public.factures (numero, type, reference, emetteur, destinataire, client_id, cleaneur_id, espace, lignes, total_ht_c, tva_c, total_ttc_c, details)
    values (public.prochain_numero('CLN-' || an), 'commission', d.reference, e_cleaneroo, emet, payeur, payeur, 'cleaneur',
      jsonb_build_array(jsonb_build_object('libelle', 'Commission Cleaneroo (' || (com_pb / 100) || ' %) · prestation ' || d.reference, 'quantite', 1, 'prix_ht_c', round(com / (1 + tva / 100)), 'tva_pct', tva)),
      round(com / (1 + tva / 100)), com - round(com / (1 + tva / 100)), com,
      jsonb_build_object('categorie', 'PS', 'categorie_libelle', 'Prestation de services', 'date_prestation', det->>'date_prestation'));
  end if;
end $function$;

-- Attestation fiscale (art. D7233-4) : par prestataire, son nom, son adresse, son SIRET, son numéro et sa date de déclaration SAP ;
-- par intervention, l'intervenant (nom et code), la date, la durée et la somme payée.
create or replace function public.attestation_fiscale(p_annee integer, p_mois integer default null::integer)
 returns jsonb language sql stable security definer set search_path to ''
as $function$
  with lignes as (
    select f.date_emission, f.reference, f.numero, f.total_ttc_c, d.rubrique_id,
           coalesce(f.emetteur->>'nom', '') as cleaneur, coalesce(f.emetteur->>'siret', '') as siret, coalesce(f.emetteur->>'adresse', '') as adresse,
           coalesce(p.sap_numero, '') as sap_numero, coalesce(to_char(p.sap_date, 'DD/MM/YYYY'), '') as sap_date,
           coalesce(f.details->>'date_prestation', to_char(coalesce(d.creneau, f.date_emission::timestamptz) at time zone 'Europe/Paris', 'YYYY-MM-DD')) as date_prestation,
           coalesce((f.details->>'duree_min')::integer, d.duree_min, 0) as duree_min,
           coalesce(f.details->'intervenant', '{}'::jsonb) as intervenant,
           (coalesce(p.sap_numero, '') <> '' and exists (select 1 from public.documents_cleaneur dc where dc.cleaneur_id = f.cleaneur_id and dc.type = 'sap' and dc.statut = 'ACCEPTE')) as sap
    from public.factures f join public.demandes d on d.reference = f.reference left join public.profils p on p.id = f.cleaneur_id
    where f.client_id = auth.uid() and f.type = 'prestation' and f.espace = 'personnel'
      and extract(year from f.date_emission) = p_annee and (p_mois is null or extract(month from f.date_emission) = p_mois)
      and (d.rubrique_id in ('home', 'textiles') or (d.rubrique_id = 'windows' and coalesce(d.details->>'typeLieuId', '') in ('', 'fenetres_logement', 'baies_veranda')))
  )
  select jsonb_build_object('annee', p_annee, 'mois', p_mois,
    'client', coalesce((select f.destinataire from public.factures f where f.client_id = auth.uid() and f.espace = 'personnel' order by f.date_emission desc limit 1), '{}'::jsonb),
    'lignes', coalesce((select jsonb_agg(jsonb_build_object('date', date_emission, 'date_prestation', date_prestation, 'reference', reference, 'numero', numero, 'montant_c', total_ttc_c,
        'rubrique_id', rubrique_id, 'cleaneur', cleaneur, 'siret', siret, 'adresse', adresse, 'sap_numero', sap_numero, 'sap_date', sap_date,
        'duree_min', duree_min, 'intervenant', intervenant, 'eligible', sap) order by cleaneur, date_prestation) from lignes), '[]'::jsonb),
    'total_eligible_c', coalesce((select sum(total_ttc_c) from lignes where sap), 0),
    'non_eligible_c', coalesce((select sum(total_ttc_c) from lignes where not sap), 0));
$function$;
