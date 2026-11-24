-- Photos avant obligatoires (prompt 2, partie 6, 24/11/2026) : dans toutes les rubriques sauf « Prestations spécialisées »,
-- une pièce (ou zone) n'est complète qu'avec sa photo avant ET sa photo après. Avant : seulement si le client avait coché
-- « Photos avant exigées » (par défaut en location saisonnière). La base l'impose désormais, quel que soit le canal
-- (site, appli Android, appli iOS, pilote automatique) : même règle que photosAvantObligatoires dans regles.js.
-- Les prestations spécialisées gardent le choix du client (case « Photos avant exigées »).

create or replace function public.piece_complete(c public.controles_pieces)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select (c.photo_avant <> '' or not coalesce((
            select coalesce((d.details->>'photosAvantExigees')::boolean, false) or d.rubrique_id <> 'special'
            from public.demandes d where d.reference = c.reference), false))
    and c.photo_apres <> ''
    and not exists (select 1 from jsonb_array_elements(c.taches) t where not coalesce((t->>'fait')::boolean, false))
    and (c.ia_statut = 'ok' or (c.ia_statut in ('ecart', 'erreur') and char_length(trim(c.justification)) >= 5));
$$;
