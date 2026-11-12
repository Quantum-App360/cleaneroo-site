-- Programme Cleaneur : 4 niveaux (12 novembre 2026, repris de l'appli iPhone de Vincent, sur le modèle d'Uber Pro).
-- Cleaneur (départ) · Confirmé (10 missions, note ≥ 4,6) · Expert (30, ≥ 4,8) · Élite (60, ≥ 4,9).
-- Un niveau de moins si le taux d'annulation dépasse 5 % ou s'il y a un avertissement en cours (12 mois).
-- Avantages (la commission ne change pas, comme chez Vincent) : badge visible des clients ; missions des particuliers
-- vues 5, 10 ou 15 min plus tôt (avant les 30 min d'avance réservées aux Cleaneurs Pro) ; Expert et Élite : missions
-- des entreprises et conciergeries comme la formule Pro ; Élite : assistance prioritaire.
-- Copie des seuils : NIVEAUX dans regles.js et Regles.kt.

create or replace function public.niveau_de(p_cleaneur uuid) returns json language sql stable security definer set search_path to '' as $$
  with m as (
    select (select count(*) from public.demandes where cleaneur_id = p_cleaneur and statut = 'TERMINEE') as faites,
           (select round(avg(a.note)::numeric, 2) from public.avis a where a.cleaneur_id = p_cleaneur and a.note is not null and public.avis_revele(a)) as note,
           (select count(*) from public.avertissements_cleaneur v where v.cleaneur_id = p_cleaneur and v.cree_le > now() - interval '12 months') as avertissements,
           (select count(distinct v.reference) from public.avertissements_cleaneur v where v.cleaneur_id = p_cleaneur and v.reference is not null
              and v.cree_le > now() - interval '12 months') as annulations),
  n as (
    select m.*, case when m.faites + m.annulations = 0 then 0 else round(100.0 * m.annulations / (m.faites + m.annulations), 1) end as annulation_pct,
      (case when m.faites >= 60 and coalesce(m.note, 0) >= 4.9 then 3 when m.faites >= 30 and coalesce(m.note, 0) >= 4.8 then 2
            when m.faites >= 10 and coalesce(m.note, 0) >= 4.6 then 1 else 0 end) as merite
    from m)
  select json_build_object('niveau', greatest(0, n.merite - (case when n.annulation_pct > 5 then 1 else 0 end) - (case when n.avertissements > 0 then 1 else 0 end)),
    'merite', n.merite, 'missions', n.faites, 'note', n.note, 'annulation_pct', n.annulation_pct, 'avertissements', n.avertissements)
  from n;
$$;

-- Niveau du Cleaneur connecté.
create or replace function public.mon_niveau() returns json language sql stable security definer set search_path to '' as $$
  select public.niveau_de(auth.uid());
$$;

-- Avance sur les missions des particuliers selon le niveau (minutes).
create or replace function public.avance_niveau(p_cleaneur uuid) returns integer language sql stable security definer set search_path to '' as $$
  select (array[0, 5, 10, 15])[1 + coalesce((public.niveau_de(p_cleaneur)->>'niveau')::int, 0)];
$$;

create or replace function public.mission_visible(d public.demandes) returns boolean language sql stable security definer set search_path to '' as $$
  select public.est_admin() or public.formule_effective(auth.uid()) = 'pro'
    or (coalesce(d.espace, 'personnel') = 'personnel'
        and (d.urgence or d.cree_le <= now() - make_interval(mins => 30 - public.avance_niveau(auth.uid()))))
    or (coalesce(d.espace, 'personnel') <> 'personnel' and coalesce((public.niveau_de(auth.uid())->>'niveau')::int, 0) >= 2)
    or exists (select 1 from public.invitations_pro i where i.statut = 'ACTIF' and i.cleaneur_id = auth.uid() and i.pro_id = d.client_id);
$$;

-- Le client voit le niveau de son Cleaneur (badge).
drop function if exists public.cleaneurs_de_mes_demandes();
create or replace function public.cleaneurs_de_mes_demandes() returns table(reference text, prenom text, niveau integer)
language sql stable security definer set search_path to '' as $$
  select d.reference, p.prenom, coalesce((public.niveau_de(d.cleaneur_id)->>'niveau')::int, 0)
  from public.demandes d join public.profils p on p.id = d.cleaneur_id
  where d.client_id = auth.uid() and d.cleaneur_id is not null and d.statut <> 'ANNULEE';
$$;

revoke execute on function public.niveau_de(uuid) from anon, public, authenticated;
revoke execute on function public.avance_niveau(uuid) from anon, public, authenticated;
revoke execute on function public.mon_niveau() from anon, public;
grant execute on function public.mon_niveau() to authenticated;
revoke execute on function public.cleaneurs_de_mes_demandes() from anon, public;
grant execute on function public.cleaneurs_de_mes_demandes() to authenticated;
