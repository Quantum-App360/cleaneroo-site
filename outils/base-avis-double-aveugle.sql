-- Avis en double aveugle (12 novembre 2026, repris de l'appli iPhone de Vincent).
-- Le client note 4 critères (qualité du ménage, ponctualité, communication, respect des consignes) ; la note est leur moyenne.
-- Le Cleaneur ne voit l'avis du client (critères, note, commentaire) qu'après avoir noté ce client, ou 14 jours après l'avis.
-- Sa moyenne ne compte que les avis déjà visibles. Le pourboire reste visible tout de suite (Mon activité).

alter table public.avis add column if not exists categories jsonb;

-- Lecture directe de la table : seulement les colonnes sans avis (le pourboire). Le reste passe par les fonctions.
revoke select on public.avis from anon, authenticated;
grant select (reference, cleaneur_id, client_id, pourboire_c, cree_le) on public.avis to authenticated;

-- L'avis du client est-il visible du Cleaneur ?
create or replace function public.avis_revele(a public.avis) returns boolean language sql stable security definer set search_path to '' as $$
  select exists (select 1 from public.avis_clients ac where ac.reference = a.reference and ac.cleaneur_id = a.cleaneur_id)
      or a.cree_le <= now() - interval '14 days';
$$;

-- Le client enregistre ses notes par critère (après valider_prestation) : par jeton (lien de suivi) ou connecté.
create or replace function public.noter_criteres(p_reference text, p_categories jsonb, p_jeton uuid default null) returns text
language plpgsql security definer set search_path to '' as $$
declare d public.demandes; k text; n integer; total integer := 0;
begin
  select * into d from public.demandes where reference = p_reference
    and ((p_jeton is not null and jeton = p_jeton) or (auth.uid() is not null and client_id = auth.uid()));
  if d.id is null then return 'introuvable'; end if;
  if jsonb_typeof(p_categories) <> 'object' then return 'note'; end if;
  for k in select unnest(array['qualite', 'ponctualite', 'communication', 'consignes']) loop
    n := (p_categories->>k)::integer;
    if n is null or n not between 1 and 5 then return 'note'; end if;
    total := total + n;
  end loop;
  update public.avis set categories = jsonb_build_object('qualite', (p_categories->>'qualite')::int, 'ponctualite', (p_categories->>'ponctualite')::int,
      'communication', (p_categories->>'communication')::int, 'consignes', (p_categories->>'consignes')::int),
    note = round(total / 4.0)::smallint
   where reference = p_reference;
  if not found then return 'avis'; end if;
  return 'ok';
end $$;

-- Avis reçus par le Cleaneur connecté : visibles ou en attente (double aveugle).
create or replace function public.avis_recus() returns table(reference text, rubrique_id text, ville text, recu_le timestamptz, revele boolean,
  visible_le timestamptz, note smallint, categories jsonb, commentaire text)
language sql stable security definer set search_path to '' as $$
  select a.reference, d.rubrique_id, d.ville, a.cree_le, public.avis_revele(a), a.cree_le + interval '14 days',
    case when public.avis_revele(a) then a.note end, case when public.avis_revele(a) then a.categories end,
    case when public.avis_revele(a) then a.commentaire else '' end
  from public.avis a join public.demandes d on d.reference = a.reference
  where a.cleaneur_id = auth.uid() and a.note is not null
  order by a.cree_le desc limit 50;
$$;

-- Tableau de bord du Cleaneur : moyenne et nombre d'avis sur les seuls avis visibles.
create or replace function public.tableau_cleaneur() returns json language sql stable security definer set search_path to '' as $$
  select json_build_object(
    'missions_terminees', (select count(*) from public.demandes where cleaneur_id = auth.uid() and statut = 'TERMINEE'),
    'formule', public.formule_effective(auth.uid()),
    'pro_offert_jusqu', (select pro_offert_jusqu from public.profils where id = auth.uid()),
    'dispo_urgence_jusqu', (select case when urgence_dispo_jusqu > now() then urgence_dispo_jusqu end from public.profils where id = auth.uid()),
    'note_moyenne', (select round(avg(a.note)::numeric, 1) from public.avis a where a.cleaneur_id = auth.uid() and a.note is not null and public.avis_revele(a)),
    'nb_avis', (select count(*) from public.avis a where a.cleaneur_id = auth.uid() and a.note is not null and public.avis_revele(a)),
    'pourboires_c', (select coalesce(sum(pourboire_c), 0) from public.avis where cleaneur_id = auth.uid()));
$$;

revoke execute on function public.avis_revele(public.avis) from anon, public, authenticated;
revoke execute on function public.avis_recus() from anon, public;
grant execute on function public.avis_recus() to authenticated;
grant execute on function public.noter_criteres(text, jsonb, uuid) to anon, authenticated;
