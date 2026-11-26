-- Cleaneroo AI, « Décrire mon besoin » (26/11/2026, lot A) : base de connaissances et journal des analyses.
-- 1. connaissances_ia : objets, matières, salissures, avertissements, équipements, règles. Lue par la fonction besoin-ia à chaque
--    analyse ; modifiable par l'administration (gestion). Ne contient aucun prix : les prix viennent du moteur du site.
-- 2. analyses_ia : trace de chaque analyse (texte du client, nombre de photos, réponse de l'IA, options retirées, validation humaine).
--    Les photos elles-mêmes ne sont PAS gardées ici : elles ne sont enregistrées qu'avec la demande, comme une réservation normale.
--    Écrite uniquement par la fonction serveur (clé de service). Le client voit les siennes, l'administration toutes.

create table if not exists public.connaissances_ia (
  id text primary key,                       -- ex. « objet:canape_tissu », « avertissement:textiles:detachage »
  type text not null check (type in ('objet', 'matiere', 'code_etiquette', 'salissure', 'avertissement', 'equipement', 'regle')),
  donnees jsonb not null default '{}'::jsonb,
  actif boolean not null default true,
  maj_le timestamptz not null default now(),
  maj_par uuid references auth.users(id) on delete set null
);
alter table public.connaissances_ia enable row level security;
drop policy if exists connaissances_ia_admin on public.connaissances_ia;
create policy connaissances_ia_admin on public.connaissances_ia for all to authenticated using (public.est_admin()) with check (public.est_admin());
-- Lecture publique des entrées actives (avertissements affichés au client, équipements proposés aux Cleaneurs).
drop policy if exists connaissances_ia_lecture on public.connaissances_ia;
create policy connaissances_ia_lecture on public.connaissances_ia for select to anon, authenticated using (actif);

create or replace function public.connaissances_ia_maj() returns trigger language plpgsql set search_path = '' as $$
begin new.maj_le := now(); new.maj_par := coalesce(auth.uid(), new.maj_par); return new; end $$;
drop trigger if exists connaissances_ia_maj on public.connaissances_ia;
create trigger connaissances_ia_maj before insert or update on public.connaissances_ia for each row execute function public.connaissances_ia_maj();

create table if not exists public.analyses_ia (
  id uuid primary key default gen_random_uuid(),
  cree_le timestamptz not null default now(),
  client_id uuid references auth.users(id) on delete set null,
  empreinte text,                            -- empreinte de l'adresse IP (limite d'usage), jamais l'adresse elle-même
  langue text not null default 'fr',
  message text not null default '',
  nb_photos int not null default 0,
  etat text not null check (etat in ('questions', 'fiche', 'validation_humaine', 'erreur')),
  reponse jsonb not null default '{}'::jsonb,
  ecartes jsonb not null default '[]'::jsonb, -- identifiants proposés par l'IA mais absents du catalogue (retirés avant affichage)
  modele text,
  reference text,                            -- demande créée à partir de cette analyse
  options_retirees jsonb not null default '[]'::jsonb,
  traite_le timestamptz,
  traite_par uuid references auth.users(id) on delete set null,
  note_admin text
);
create index if not exists analyses_ia_empreinte on public.analyses_ia (empreinte, cree_le desc);
create index if not exists analyses_ia_etat on public.analyses_ia (etat, cree_le desc);
alter table public.analyses_ia enable row level security;
drop policy if exists analyses_ia_admin on public.analyses_ia;
create policy analyses_ia_admin on public.analyses_ia for all to authenticated using (public.est_admin()) with check (public.est_admin());
drop policy if exists analyses_ia_client on public.analyses_ia;
create policy analyses_ia_client on public.analyses_ia for select to authenticated using (client_id = auth.uid());

-- Le client rattache une analyse à sa demande et note les options qu'il a retirées (avec l'avertissement lu).
-- Possible seulement pour la demande dont il a le jeton, et une seule fois.
create or replace function public.lier_analyse_ia(p_analyse uuid, p_reference text, p_jeton text, p_options_retirees jsonb)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.demandes d where d.reference = p_reference and d.jeton = p_jeton) then return false; end if;
  update public.analyses_ia set reference = p_reference, options_retirees = coalesce(p_options_retirees, '[]'::jsonb)
   where id = p_analyse and reference is null and cree_le > now() - interval '2 days';
  return found;
end $$;
revoke all on function public.lier_analyse_ia(uuid, text, text, jsonb) from public;
grant execute on function public.lier_analyse_ia(uuid, text, text, jsonb) to anon, authenticated;
