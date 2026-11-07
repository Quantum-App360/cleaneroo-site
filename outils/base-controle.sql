-- Contrôle de fin de mission, pièce par pièce (7 novembre 2026), décidé par l'utilisateur :
--   pour chaque pièce (ou zone) : photo « avant », tâches à cocher, photo « après », contrôle par IA (comparaison avant / après).
--   Écart signalé par l'IA → le Cleaneur corrige et reprend la photo, OU écrit une justification (le client voit les deux).
--   « J'ai terminé » (EN_COURS → A_VALIDER) refusé tant qu'une pièce n'est pas complète.
-- Pièces : calculées par l'appli et le site (controle.js / ControlePieces.kt) à partir de la réservation, enregistrées une seule fois.
-- Photos : stockage privé « photos-controles », chemin <référence>/<pièce>/<avant|apres>-<horodatage>.jpg.
-- IA : fonction serveur « controle-ia » (clé ANTHROPIC_API_KEY dans les secrets Supabase).

create table if not exists public.controles_pieces (
  id uuid primary key default gen_random_uuid(),
  reference text not null references public.demandes (reference) on delete cascade,
  piece_id text not null check (char_length(piece_id) <= 40),
  nom text not null check (char_length(nom) <= 80),
  ordre smallint not null default 0,
  taches jsonb not null default '[]'::jsonb,          -- [{id, nom, fait}]
  photo_avant text not null default '',
  photo_avant_le timestamptz,
  photo_apres text not null default '',
  photo_apres_le timestamptz,
  ia_statut text not null default 'aucun' check (ia_statut in ('aucun', 'en_cours', 'ok', 'ecart', 'erreur')),
  ia_resultat jsonb,
  justification text not null default '' check (char_length(justification) <= 600),
  maj_le timestamptz not null default now(),
  unique (reference, piece_id)
);
create index if not exists controles_pieces_reference on public.controles_pieces (reference);
alter table public.controles_pieces enable row level security;

-- Lecture : le Cleaneur de la mission, le client de la demande, l'administration. Aucune écriture directe (fonctions ci-dessous).
drop policy if exists "controle : lire" on public.controles_pieces;
create policy "controle : lire" on public.controles_pieces for select to authenticated using (
  exists (select 1 from public.demandes d where d.reference = controles_pieces.reference
          and (d.cleaneur_id = (select auth.uid()) or d.client_id = (select auth.uid())))
  or (select public.est_admin()));

-- Pièces de la mission : enregistrées une seule fois, par le Cleaneur, sur place ou pendant le ménage.
create or replace function public.enregistrer_pieces(p_reference text, p_pieces jsonb) returns text
language plpgsql security definer set search_path = '' as $$
declare d public.demandes; x jsonb; i int := 0;
begin
  select * into d from public.demandes where reference = p_reference;
  if not found then return 'introuvable'; end if;
  if d.cleaneur_id is distinct from auth.uid() then return 'interdit'; end if;
  if d.statut not in ('SUR_PLACE', 'EN_COURS') then return 'etape'; end if;
  if exists (select 1 from public.controles_pieces where reference = p_reference) then return 'deja'; end if;
  if jsonb_typeof(p_pieces) <> 'array' or jsonb_array_length(p_pieces) not between 1 and 30 then return 'invalide'; end if;
  for x in select * from jsonb_array_elements(p_pieces) loop
    insert into public.controles_pieces (reference, piece_id, nom, ordre, taches)
    values (p_reference, left(x->>'id', 40), left(x->>'nom', 80), i,
      coalesce((select jsonb_agg(jsonb_build_object('id', left(t->>'id', 60), 'nom', left(t->>'nom', 160), 'fait', false))
                from jsonb_array_elements(coalesce(x->'taches', '[]'::jsonb)) t), '[]'::jsonb));
    i := i + 1;
  end loop;
  return 'ok';
end $$;

-- Mise à jour d'une pièce par le Cleaneur : tâches cochées, photos, justification. Une nouvelle photo « après » relance le contrôle IA.
create or replace function public.maj_piece(p_reference text, p_piece text, p_taches jsonb default null,
  p_photo_avant text default null, p_photo_apres text default null, p_justification text default null) returns text
language plpgsql security definer set search_path = '' as $$
declare d public.demandes; c public.controles_pieces;
begin
  select * into d from public.demandes where reference = p_reference;
  if not found then return 'introuvable'; end if;
  if d.cleaneur_id is distinct from auth.uid() then return 'interdit'; end if;
  if d.statut not in ('SUR_PLACE', 'EN_COURS') then return 'etape'; end if;
  select * into c from public.controles_pieces where reference = p_reference and piece_id = p_piece;
  if not found then return 'introuvable'; end if;
  -- Photos : seulement dans le dossier de cette mission et de cette pièce
  if p_photo_avant is not null and p_photo_avant not like p_reference || '/' || p_piece || '/avant-%' then return 'invalide'; end if;
  if p_photo_apres is not null and p_photo_apres not like p_reference || '/' || p_piece || '/apres-%' then return 'invalide'; end if;
  update public.controles_pieces set
    taches = case when p_taches is null then taches else (
      select coalesce(jsonb_agg(jsonb_set(t, '{fait}', to_jsonb(coalesce((p_taches ->> (t->>'id'))::boolean, (t->>'fait')::boolean)))), '[]'::jsonb)
      from jsonb_array_elements(taches) t) end,
    photo_avant = coalesce(p_photo_avant, photo_avant),
    photo_avant_le = case when p_photo_avant is null then photo_avant_le else now() end,
    photo_apres = coalesce(p_photo_apres, photo_apres),
    photo_apres_le = case when p_photo_apres is null then photo_apres_le else now() end,
    ia_statut = case when p_photo_apres is null then ia_statut else 'aucun' end,
    ia_resultat = case when p_photo_apres is null then ia_resultat else null end,
    justification = coalesce(left(p_justification, 600), justification),
    maj_le = now()
  where id = c.id;
  return 'ok';
end $$;

-- Pièce complète : photos avant et après, toutes les tâches cochées, IA d'accord OU écart justifié (ou IA indisponible et justifié).
create or replace function public.piece_complete(c public.controles_pieces) returns boolean
language sql immutable set search_path = '' as $$
  select c.photo_avant <> '' and c.photo_apres <> ''
    and not exists (select 1 from jsonb_array_elements(c.taches) t where not coalesce((t->>'fait')::boolean, false))
    and (c.ia_statut = 'ok' or (c.ia_statut in ('ecart', 'erreur') and char_length(trim(c.justification)) >= 5));
$$;

-- Étapes de la mission : « J'ai terminé » seulement quand toutes les pièces sont complètes.
create or replace function public.avancer_mission(p_reference text, p_statut text) returns text
language plpgsql security definer set search_path = '' as $$
declare v_statut text; v_cleaneur uuid;
begin
  select statut, cleaneur_id into v_statut, v_cleaneur from public.demandes where reference = p_reference;
  if v_statut is null then return 'introuvable'; end if;
  if v_cleaneur is distinct from auth.uid() then return 'interdit'; end if;
  if not ((v_statut = 'CONFIRMEE' and p_statut = 'EN_ROUTE') or (v_statut = 'EN_ROUTE' and p_statut = 'SUR_PLACE')
       or (v_statut = 'SUR_PLACE' and p_statut = 'EN_COURS') or (v_statut = 'EN_COURS' and p_statut = 'A_VALIDER')) then return 'etape'; end if;
  if p_statut = 'A_VALIDER' and (
       not exists (select 1 from public.controles_pieces where reference = p_reference)
       or exists (select 1 from public.controles_pieces c where c.reference = p_reference and not public.piece_complete(c))) then
    return 'controle';
  end if;
  update public.demandes set statut = p_statut where reference = p_reference;
  return 'ok';
end $$;

revoke all on function public.enregistrer_pieces(text, jsonb) from public, anon;
revoke all on function public.maj_piece(text, text, jsonb, text, text, text) from public, anon;
grant execute on function public.enregistrer_pieces(text, jsonb) to authenticated;
grant execute on function public.maj_piece(text, text, jsonb, text, text, text) to authenticated;

-- Missions du Cleaneur : avec le détail de la réservation (tâches, pièces) pour la liste de contrôle.
drop function if exists public.mes_missions();
create function public.mes_missions()
returns table (reference text, statut text, rubrique_id text, creneau timestamptz, duree_min integer, estimation_c integer, sur_devis boolean,
  rue text, code_postal text, ville text, prenom text, telephone text, accueil text, remarque text, acces jsonb, details jsonb)
language sql stable security definer set search_path = '' as $$
  select d.reference, d.statut, d.rubrique_id, d.creneau, d.duree_min, d.estimation_c, d.sur_devis, d.rue, d.code_postal, d.ville,
    d.prenom, d.telephone, d.accueil, d.remarque, coalesce(d.acces, '{}'::jsonb), coalesce(d.details, '{}'::jsonb)
  from public.demandes d
  where d.cleaneur_id = auth.uid() and d.statut in ('CONFIRMEE', 'EN_ROUTE', 'SUR_PLACE', 'EN_COURS', 'A_VALIDER')
  order by d.creneau nulls last;
$$;
revoke all on function public.mes_missions() from public, anon;
grant execute on function public.mes_missions() to authenticated;

-- Photos du contrôle : stockage privé. Dépôt par le Cleaneur de la mission (sur place / en cours) ; lecture par lui, le client, l'administration.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos-controles', 'photos-controles', false, 8388608, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
drop policy if exists "controle : deposer photo" on storage.objects;
create policy "controle : deposer photo" on storage.objects for insert to authenticated with check (
  bucket_id = 'photos-controles' and exists (select 1 from public.demandes d where d.reference = (storage.foldername(name))[1]
    and d.cleaneur_id = (select auth.uid()) and d.statut in ('SUR_PLACE', 'EN_COURS')));
drop policy if exists "controle : lire photo" on storage.objects;
create policy "controle : lire photo" on storage.objects for select to authenticated using (
  bucket_id = 'photos-controles' and (exists (select 1 from public.demandes d where d.reference = (storage.foldername(name))[1]
    and (d.cleaneur_id = (select auth.uid()) or d.client_id = (select auth.uid()))) or (select public.est_admin())));
