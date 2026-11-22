-- Inscription Cleaneur (22 novembre 2026, retour de Vincent) : en mode Cleaneur, « Je suis Cleaneur indépendant » et
-- « Je référence ma société de nettoyage » ouvrent chacun leur propre formulaire (plus les statuts client).
-- Champs demandés : civilité, nom, prénom, téléphone, e-mail ; pour une société : raison sociale, SIRET ou SIREN
-- et qualité de la personne qui inscrit la société (gérant, président…). La pré-inscription crée le compte ; le Cleaneur
-- arrive ensuite sur « Mon dossier » pour envoyer ses documents.

alter table public.profils add column if not exists civilite text check (civilite in ('madame', 'monsieur'));
alter table public.profils add column if not exists qualite text check (char_length(qualite) <= 60);
grant update (civilite, qualite) on public.profils to authenticated;

create or replace function public.nouveau_profil()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb); st text[]; soc text := left(coalesce(m->>'societe', ''), 120);
  sir text := regexp_replace(coalesce(m->>'siret_societe', ''), '[^0-9]', '', 'g'); societe_ok boolean;
  sec text := nullif(coalesce(m->>'secteur', ''), '');
  civ text := nullif(coalesce(m->>'civilite', ''), ''); qual text := nullif(left(btrim(coalesce(m->>'qualite', '')), 60), '');
  tel text := nullif(left(regexp_replace(coalesce(m->>'telephone', ''), '[^0-9+ ]', '', 'g'), 20), '');
  societe_cleaneur boolean;
begin
  if jsonb_typeof(m->'statuts') = 'array' then
    select coalesce(array_agg(distinct x), '{}') into st from jsonb_array_elements_text(m->'statuts') x where x in ('particulier', 'entreprise', 'pro', 'hotellerie', 'cleaneur');
  else st := array[case when m->>'role' = 'cleaneur' then 'cleaneur' when m->>'espace' = 'pro' then 'pro' else 'particulier' end]; end if;
  societe_ok := soc <> '' and public.siren_siret_valide(sir);
  -- Société de nettoyage inscrite depuis le mode Cleaneur : raison sociale et SIRET gardés, espace « Ma société » ouvert
  -- si l'engagement de formation des salariés est coché (comme activer_societe_equipe).
  societe_cleaneur := 'cleaneur' = any (st) and coalesce(m->>'type_cleaneur', '') = 'societe' and societe_ok;
  if not societe_ok then st := array_remove(array_remove(array_remove(st, 'pro'), 'entreprise'), 'hotellerie'); end if;
  if cardinality(st) = 0 then st := '{particulier}'; end if;
  if not (societe_cleaneur or 'pro' = any (st) or 'entreprise' = any (st) or 'hotellerie' = any (st)) then soc := ''; sir := ''; end if;
  -- Secteur d'activité (comptes Entreprise) : seulement une valeur connue.
  if not ('entreprise' = any (st)) or sec not in ('bureaux', 'medical', 'commerce', 'restaurant', 'garage', 'funeraire', 'syndic', 'nautisme', 'loueur', 'evenementiel', 'btp', 'industrie', 'autre') then sec := null; end if;
  if civ not in ('madame', 'monsieur') then civ := null; end if;
  if not societe_cleaneur and not ('pro' = any (st) or 'entreprise' = any (st) or 'hotellerie' = any (st)) then qual := null; end if;
  insert into public.profils (id, role, prenom, nom, statuts, espace, societe, siret_societe, secteur, civilite, qualite, telephone, siret, societe_equipe)
  values (new.id, case when 'cleaneur' = any (st) then 'cleaneur' else 'client' end, left(coalesce(m->>'prenom', ''), 80), left(coalesce(m->>'nom', ''), 80), st,
    case when 'cleaneur' = any (st) then 'cleaneur' when 'pro' = any (st) then 'pro' when 'hotellerie' = any (st) then 'hotellerie' when 'entreprise' = any (st) then 'entreprise' else 'particulier' end,
    nullif(soc, ''), sir, sec, civ, qual, tel,
    case when societe_cleaneur and length(sir) = 14 then sir end,
    societe_cleaneur and coalesce(m->>'engagement_formation', '') = 'true') on conflict do nothing;
  if coalesce(m->>'code_parrain', '') <> '' then perform public.lier_parrain(new.id, m->>'code_parrain'); end if;
  return new;
end $function$;

-- Comptes rendus du Cleaneur (refonte de l'espace Cleaneur, 22 novembre 2026) : onglet Missions › Terminées, site et applis.
-- Missions terminées (ou à valider après le départ), de la plus récente : déroulé, pièces, photos, signature, avis, versement.
-- Salarié d'une société : pas de montants (comme mes_missions).
create or replace function public.mes_comptes_rendus() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(x order by ord desc nulls last), '[]'::jsonb) from (
    select d.creneau as ord, jsonb_build_object('reference', d.reference, 'statut', d.statut, 'rubrique_id', d.rubrique_id, 'creneau', d.creneau,
      'duree_min', d.duree_min, 'ville', d.ville, 'prenom', d.prenom, 'etapes', coalesce(d.etapes, '{}'::jsonb),
      'montant_c', case when me.employeur_id is not null then 0 else d.estimation_c end,
      'versement_statut', case when me.employeur_id is not null then null else d.versement_statut end,
      'versement_c', case when me.employeur_id is not null then 0 else coalesce(d.versement_c, 0) end,
      'note', a.note, 'commentaire', coalesce(a.commentaire, ''),
      'pourboire_c', case when me.employeur_id is not null then 0 else coalesce(a.pourboire_c, 0) end,
      'pieces', (select count(*) from public.controles_pieces c where c.reference = d.reference),
      'photos', (select count(nullif(c.photo_avant, '')) + count(nullif(c.photo_apres, '')) from public.controles_pieces c where c.reference = d.reference),
      'signe', exists (select 1 from public.signatures s where s.reference = d.reference and s.role = 'cleaneur'),
      'litige', (select l.statut from public.litiges l where l.reference = d.reference order by l.cree_le desc limit 1)) as x
    from public.demandes d
    cross join (select employeur_id from public.profils where id = auth.uid()) me
    left join public.avis a on a.reference = d.reference
    where (d.cleaneur_id = auth.uid() or auth.uid() = any (d.equipiers))
      and (d.statut = 'TERMINEE' or (d.statut = 'A_VALIDER' and d.etapes ? 'depart'))
    order by d.creneau desc nulls last
    limit 100) t;
$$;
revoke all on function public.mes_comptes_rendus() from public, anon;
grant execute on function public.mes_comptes_rendus() to authenticated;
