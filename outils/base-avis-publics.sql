-- APPLIQUÉ le 24/11/2026 (migration avis_publics), avec l'accord de Michael ; testé en visiteur anonyme dans une transaction annulée.
-- Avis publics (prompt 2, partie 4, 24/11/2026) : section « Ils nous font confiance » de l'accueil et de la page Prestations.
-- Lecture publique (visiteurs non connectés compris) des seuls avis PUBLIÉS, c'est-à-dire révélés après la période en double aveugle
-- (fonction avis_revele : le Cleaneur a noté le client, ou 14 jours sont passés).
-- Renvoie : nombre d'avis publiés, note moyenne, et les 6 plus récents avec la note, le commentaire, le prénom suivi de l'initiale
-- du nom, la ville, la prestation et le mois. Jamais d'adresse, de nom complet, d'e-mail, de téléphone ni de référence de demande.
-- Les numéros de téléphone et adresses e-mail éventuellement écrits dans un commentaire sont masqués.

create or replace function public.avis_publics()
returns jsonb
language sql
stable
security definer
set search_path to ''
as $$
  with publies as (
    select a.note, a.commentaire, a.cree_le, d.rubrique_id, d.ville,
           coalesce(nullif(trim(d.prenom), ''), nullif(trim(p.prenom), '')) as prenom,
           coalesce(nullif(trim(d.nom), ''), nullif(trim(p.nom), '')) as nom
    from public.avis a
    join public.demandes d on d.reference = a.reference
    left join public.profils p on p.id = a.client_id
    where a.note between 1 and 5 and public.avis_revele(a)
  )
  select jsonb_build_object(
    'nombre', (select count(*) from publies),
    'moyenne', (select round(avg(note)::numeric, 1) from publies),
    'avis', coalesce((select jsonb_agg(to_jsonb(x) - 'tri' order by x.tri desc) from (
      select a.cree_le as tri,
             a.note,
             nullif(trim(regexp_replace(regexp_replace(coalesce(a.commentaire, ''),
               '[[:alnum:]._%+-]+@[[:alnum:].-]+\.[[:alpha:]]{2,}', '[masqué]', 'g'),
               '(\+?\d[\d .-]{7,}\d)', '[masqué]', 'g')), '') as commentaire,
             initcap(split_part(coalesce(a.prenom, 'Client'), ' ', 1))
               || coalesce(' ' || upper(left(a.nom, 1)) || '.', '') as auteur,
             nullif(trim(a.ville), '') as ville,
             a.rubrique_id as rubrique,
             to_char(a.cree_le at time zone 'Europe/Paris', 'YYYY-MM') as mois
      from publies a order by a.cree_le desc limit 6) x), '[]'::jsonb)
  );
$$;

revoke all on function public.avis_publics() from public;
grant execute on function public.avis_publics() to anon, authenticated;
