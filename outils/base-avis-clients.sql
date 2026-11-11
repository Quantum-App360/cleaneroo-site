-- Le Cleaneur note aussi le client (11 novembre 2026, repris de l'appli iPhone de Vincent).
-- Après la mission (14 jours pour le faire) : étoiles de 1 à 5 et étiquettes (Accueil agréable, Logement conforme, Accès facile,
-- Consignes claires ; Logement non conforme, Accès compliqué, Comportement déplacé). Ces notes ne sont visibles que des
-- Cleaneurs (moyenne du client sur les missions disponibles) et de l'administration, jamais du client.
-- Double aveugle : le Cleaneur ne voit jamais la note détaillée du client sur sa mission, seulement sa moyenne générale.

create table if not exists public.avis_clients (
  reference text primary key,
  cree_le timestamptz not null default now(),
  cleaneur_id uuid references auth.users(id) on delete set null,
  client_id uuid references auth.users(id) on delete set null,
  email_client text,
  note int not null check (note between 1 and 5),
  etiquettes text[] not null default '{}',
  commentaire text not null default '' check (char_length(commentaire) <= 500)
);
alter table public.avis_clients enable row level security;
drop policy if exists avis_clients_admin on public.avis_clients;
create policy avis_clients_admin on public.avis_clients for select using (public.est_admin());

-- Missions terminées des 14 derniers jours que le Cleaneur n'a pas encore notées.
create or replace function public.missions_a_noter()
returns table (reference text, rubrique_id text, ville text, prenom text, creneau timestamptz)
language sql stable security definer set search_path to '' as $$
  select d.reference, d.rubrique_id, d.ville, d.prenom, d.creneau from public.demandes d
   where d.cleaneur_id = auth.uid() and (d.statut = 'TERMINEE' or (d.statut = 'A_VALIDER' and d.etapes ? 'depart'))
     and coalesce((d.etapes->>'fin')::timestamptz, d.maj_le) > now() - interval '14 days'
     and not exists (select 1 from public.avis_clients a where a.reference = d.reference)
   order by d.creneau desc limit 20;
$$;
grant execute on function public.missions_a_noter() to authenticated;

-- Note du client par le Cleaneur de la mission : "ok", "interdit", "etape", "delai" ou "note".
create or replace function public.noter_client(p_reference text, p_note int, p_etiquettes text[] default '{}', p_commentaire text default '')
returns text language plpgsql security definer set search_path to '' as $$
declare d public.demandes;
  autorisees text[] := array['ACCUEIL_AGREABLE', 'LOGEMENT_CONFORME', 'ACCES_FACILE', 'CONSIGNES_CLAIRES', 'LOGEMENT_NON_CONFORME', 'ACCES_COMPLIQUE', 'COMPORTEMENT_DEPLACE'];
begin
  select * into d from public.demandes where reference = p_reference;
  if d.id is null or d.cleaneur_id is distinct from auth.uid() then return 'interdit'; end if;
  if not (d.statut = 'TERMINEE' or (d.statut = 'A_VALIDER' and d.etapes ? 'depart')) then return 'etape'; end if;
  if coalesce((d.etapes->>'fin')::timestamptz, d.maj_le) < now() - interval '14 days' then return 'delai'; end if;
  if p_note is null or p_note not between 1 and 5 then return 'note'; end if;
  insert into public.avis_clients (reference, cleaneur_id, client_id, email_client, note, etiquettes, commentaire)
  values (d.reference, d.cleaneur_id, d.client_id, lower(d.email), p_note,
          coalesce((select array_agg(distinct e) from unnest(p_etiquettes) e where e = any(autorisees)), '{}'), left(coalesce(trim(p_commentaire), ''), 500))
  on conflict (reference) do update set note = excluded.note, etiquettes = excluded.etiquettes, commentaire = excluded.commentaire;
  return 'ok';
end $$;
grant execute on function public.noter_client(text, int, text[], text) to authenticated;

-- Moyenne du client de chaque mission disponible (Cleaneurs actifs seulement ; aucune donnée personnelle).
create or replace function public.notes_clients(p_references text[])
returns table (reference text, note_moyenne numeric, nb int)
language sql stable security definer set search_path to '' as $$
  select d.reference, round(avg(a.note), 1), count(a.*)::int
    from public.demandes d
    join public.avis_clients a on a.client_id = d.client_id or a.email_client = lower(d.email)
   where public.cleaneur_actif() and d.reference = any(p_references)
   group by d.reference;
$$;
grant execute on function public.notes_clients(text[]) to authenticated;
