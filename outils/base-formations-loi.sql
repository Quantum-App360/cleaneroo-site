-- Formations (16 novembre 2026), appliqué par Claude : seules les formations exigées par la loi bloquent les missions (Certibiocide « nuisibles »).
-- Les formations Cleaneroo (socle, quiz, techniques) sont conseillées, jamais imposées : un indépendant ne doit pas recevoir
-- une formation imposée par la plateforme (indice de lien de subordination). Même liste que REGLES.MODULES_EXIGES_PAR_LA_LOI.
create or replace function public.modules_exiges_loi() returns text[] language sql immutable set search_path = '' as $$
  select array['nuisibles']::text[];
$$;
create or replace function public.qualifie(d public.demandes) returns boolean language sql stable security definer set search_path = '' as $$
  select public.est_admin() or coalesce(array(select x from unnest(public.qualifs_requises(d.rubrique_id, d.details->>'typeLieuId', d.details->'taches')) x
    where x = any (public.modules_exiges_loi())), '{}') <@ public.modules_valides(auth.uid());
$$;
