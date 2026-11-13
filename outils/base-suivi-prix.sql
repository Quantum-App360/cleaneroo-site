-- Page de suivi (13 novembre 2026) : même décompte qu'à la réservation — la remise de parrainage et la cagnotte utilisées
-- sont renvoyées avec la demande, pour afficher le vrai « Total à payer » (prestation + frais de service − remises).
drop function if exists public.suivi_demande(text, uuid);
create function public.suivi_demande(p_reference text, p_jeton uuid)
 returns table(reference text, statut text, rubrique_id text, details jsonb, estimation_c integer, credit_impot_c integer, duree_min integer,
   nombre_cleaneurs smallint, sur_devis boolean, creneau timestamp with time zone, flexible boolean, choix_cleaneur text, rue text, code_postal text,
   ville text, accueil text, cree_le timestamp with time zone, maj_le timestamp with time zone, remise_parrainage_c integer, cagnotte_c integer)
 language sql stable security definer set search_path to ''
as $$
  select d.reference, d.statut, d.rubrique_id, d.details, d.estimation_c, d.credit_impot_c, d.duree_min, d.nombre_cleaneurs,
         d.sur_devis, d.creneau, d.flexible, d.choix_cleaneur, d.rue, d.code_postal, d.ville, d.accueil, d.cree_le, d.maj_le,
         coalesce(d.remise_parrainage_c, 0), coalesce(d.cagnotte_c, 0)
  from public.demandes d where d.reference = p_reference and d.jeton = p_jeton;
$$;
grant execute on function public.suivi_demande(text, uuid) to anon, authenticated, service_role;
