-- « Ma société » · Activité par période (24 novembre 2026, demande de Vincent).
-- Lecture seule : ne change ni les prix, ni les commissions, ni aucune autre fonction.
-- missions_societe() ne garde que 45 jours de missions terminées ; les vues « Mois » et « Année » ont besoin de toute la période.
-- Date retenue : celle de l'intervention (creneau) en heure de Paris. commission_c : commission réellement facturée (facture
-- « commission » de la mission), nulle si la facture n'existe pas encore (le site prend alors le taux de la formule).
create or replace function public.activite_societe(p_debut date, p_fin date)
 returns table(reference text, statut text, rubrique_id text, creneau timestamptz, duree_min integer, estimation_c integer, commission_c integer,
   chef_id uuid, chef_prenom text, equipiers uuid[], equipiers_prenoms text[])
 language sql stable security definer set search_path = '' as $$
  select d.reference, d.statut, d.rubrique_id, d.creneau, d.duree_min, d.estimation_c,
    (select sum(f.total_ttc_c)::integer from public.factures f where f.reference = d.reference and f.type = 'commission'),
    case when d.cleaneur_id = auth.uid() then null else d.cleaneur_id end,
    case when d.cleaneur_id = auth.uid() then null else (select p.prenom from public.profils p where p.id = d.cleaneur_id) end,
    d.equipiers,
    -- Prénoms dans l'ordre du tableau equipiers (le site les associe par position).
    array(select (select p.prenom from public.profils p where p.id = e.id) from unnest(coalesce(d.equipiers, '{}')) with ordinality e(id, n) order by e.n)
  from public.demandes d
  where exists (select 1 from public.profils me where me.id = auth.uid() and me.societe_equipe)
    and (d.societe_id = auth.uid() or d.cleaneur_id = auth.uid())
    and d.statut in ('A_VALIDER', 'TERMINEE')
    and p_fin >= p_debut and p_fin - p_debut <= 800
    and (d.creneau at time zone 'Europe/Paris')::date between p_debut and p_fin
  order by d.creneau
  limit 5000;
$$;
revoke all on function public.activite_societe(date, date) from public, anon;
grant execute on function public.activite_societe(date, date) to authenticated;
