-- Audit de sécurité du 24 novembre 2026 (prompt conciergeries, partie 5) : corrections validées par Michael (« Lance tout », 15 h 15).
-- 1. Adresse exacte et guide d'accès : le Cleaneur ne les voit qu'une fois confirmé, et plus après la fin de l'intervention.
--    constat_arrivee : le Cleaneur n'y accède que pendant la mission (le client, le lien de suivi et l'administrateur, toujours).
--    bon_intervention : la rue n'est plus renvoyée au Cleaneur une fois la mission terminée (la ville reste, pour sa comptabilité).
-- 2. Fonctions de calcul internes (rattache, frais_cleaneroo_c, net_cleaneur_c, limite_meme_site) : plus appelables directement
--    par un visiteur ou un compte ; elles restent utilisées par les fonctions du serveur.

create or replace function public.constat_arrivee(p_reference text, p_jeton uuid default null::uuid)
 returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('reference', d.reference, 'rubrique_id', d.rubrique_id, 'creneau', d.creneau,
    'adresse', d.rue || ', ' || d.code_postal || ' ' || d.ville, 'client', trim(coalesce(d.prenom, '') || ' ' || coalesce(d.nom, '')),
    'arrivee', d.etapes->>'sur_place',
    'cleaneur', coalesce((select trim(p.prenom || ' ' || left(coalesce(p.nom, ''), 1) || '.') from public.profils p where p.id = d.cleaneur_id), ''),
    'siret', coalesce((select p.siret from public.profils p where p.id = d.cleaneur_id), ''),
    'signalements', coalesce((select jsonb_agg(jsonb_build_object('type', s.type, 'texte', s.texte, 'photo', s.photo, 'le', s.cree_le) order by s.cree_le)
                              from public.signalements_arrivee s where s.reference = d.reference), '[]'::jsonb))
  from public.demandes d
  where d.reference = p_reference
    and ((p_jeton is not null and d.jeton = p_jeton) or d.client_id = auth.uid()
         or (d.cleaneur_id = auth.uid() and d.statut in ('CONFIRMEE', 'EN_ROUTE', 'SUR_PLACE', 'EN_COURS'))
         or exists (select 1 from public.profils a where a.id = auth.uid() and a.role = 'admin'));
$$;

create or replace function public.bon_intervention(p_reference text, p_jeton uuid default null::uuid)
 returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('reference', d.reference, 'statut', d.statut, 'rubrique_id', d.rubrique_id, 'creneau', d.creneau,
    'duree_min', d.duree_min, 'nombre_cleaneurs', d.nombre_cleaneurs, 'estimation_c', d.estimation_c, 'credit_impot_c', d.credit_impot_c,
    'client', trim(coalesce(d.prenom, '') || ' ' || coalesce(d.nom, '')),
    'rue', case when complet then d.rue else '' end, 'code_postal', d.code_postal, 'ville', d.ville,
    'remarque', d.remarque, 'etapes', coalesce(d.etapes, '{}'::jsonb), 'taches', coalesce(d.details->'taches', '[]'::jsonb),
    'cleaneur', coalesce((select p.prenom from public.profils p where p.id = d.cleaneur_id), ''),
    'siret_cleaneur', coalesce((select p.siret from public.profils p where p.id = d.cleaneur_id), ''))
  from public.demandes d,
    lateral (select (p_jeton is not null and d.jeton = p_jeton) or d.client_id = auth.uid()
                    or exists (select 1 from public.profils a where a.id = auth.uid() and a.role = 'admin')
                    or d.statut in ('CONFIRMEE', 'EN_ROUTE', 'SUR_PLACE', 'EN_COURS') as complet) c
  where d.reference = p_reference
    and ((p_jeton is not null and d.jeton = p_jeton) or d.client_id = auth.uid() or d.cleaneur_id = auth.uid()
         or exists (select 1 from public.profils a where a.id = auth.uid() and a.role = 'admin'));
$$;

revoke execute on function public.rattache(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.frais_cleaneroo_c(public.demandes, uuid) from public, anon, authenticated;
revoke execute on function public.net_cleaneur_c(public.demandes, uuid) from public, anon, authenticated;
revoke execute on function public.limite_meme_site(public.demandes) from public, anon, authenticated;
