-- 20/11/2026 : notifications archivées (glisser pour archiver) et demandes au support (assistant guidé, réponse sous 48 h).

-- Notifications : archivées plutôt que supprimées, retrouvables dans « Archives ».
alter table public.notifications add column if not exists archivee_le timestamptz;
create index if not exists notifications_dest_archive on public.notifications (destinataire, espace, archivee_le);

create or replace function public.mes_notifications(p_espace text)
returns setof public.notifications language sql stable security definer set search_path to '' as $$
  select * from public.notifications where destinataire = auth.uid() and espace = p_espace and archivee_le is null order by cree_le desc limit 120;
$$;
create or replace function public.mes_notifications_archivees(p_espace text)
returns setof public.notifications language sql stable security definer set search_path to '' as $$
  select * from public.notifications where destinataire = auth.uid() and espace = p_espace and archivee_le is not null order by cree_le desc limit 300;
$$;
create or replace function public.archiver_notification(p_id uuid, p_archiver boolean default true)
returns void language sql security definer set search_path to '' as $$
  update public.notifications set archivee_le = case when p_archiver then now() else null end, lu = true
  where id = p_id and destinataire = auth.uid();
$$;
create or replace function public.tout_archiver(p_espace text)
returns void language sql security definer set search_path to '' as $$
  update public.notifications set archivee_le = now(), lu = true where destinataire = auth.uid() and espace = p_espace and archivee_le is null;
$$;
revoke execute on function public.mes_notifications_archivees(text), public.archiver_notification(uuid, boolean), public.tout_archiver(text) from public, anon;
grant execute on function public.mes_notifications_archivees(text), public.archiver_notification(uuid, boolean), public.tout_archiver(text) to authenticated;

-- Support : ce que l'assistant n'a pas pu résoudre seul devient une demande à valider (réponse sous 48 h).
create table if not exists public.demandes_support (
  id uuid primary key default gen_random_uuid(),
  numero text unique default ('SUP-' || to_char(now(), 'YYMMDD') || '-' || upper(substr(md5(random()::text), 1, 4))),
  auteur uuid references auth.users(id) on delete set null default auth.uid(),
  email text not null check (length(email) between 5 and 200),
  prenom text check (length(prenom) <= 80),
  espace text check (espace in ('client', 'cleaneur', 'visiteur')),
  categorie text not null check (length(categorie) <= 60),
  reference text check (length(reference) <= 40),
  resume text not null check (length(resume) between 5 and 4000),
  conversation jsonb not null default '[]'::jsonb,
  statut text not null default 'A_VALIDER' check (statut in ('A_VALIDER', 'EN_COURS', 'RESOLUE', 'REFUSEE')),
  reponse text check (length(reponse) <= 4000),
  cree_le timestamptz not null default now(),
  echeance timestamptz not null default (now() + interval '48 hours'),
  traite_le timestamptz,
  traite_par uuid references auth.users(id) on delete set null
);
alter table public.demandes_support enable row level security;
drop policy if exists "support ajout" on public.demandes_support;
create policy "support ajout" on public.demandes_support for insert to anon, authenticated
  with check ((auteur is null and auth.uid() is null) or auteur = auth.uid());
drop policy if exists "support lecture" on public.demandes_support;
create policy "support lecture" on public.demandes_support for select to authenticated using (auteur = auth.uid() or public.est_admin());
drop policy if exists "support traitement" on public.demandes_support;
create policy "support traitement" on public.demandes_support for update to authenticated using (public.est_admin()) with check (public.est_admin());
create index if not exists demandes_support_statut on public.demandes_support (statut, echeance);

-- Réponse du support : notifie l'auteur dans l'appli.
create or replace function public.repondre_support(p_id uuid, p_statut text, p_reponse text)
returns void language plpgsql security definer set search_path to '' as $$
declare d public.demandes_support;
begin
  if not public.est_admin() then raise exception 'refuse'; end if;
  update public.demandes_support set statut = p_statut, reponse = p_reponse, traite_le = now(), traite_par = auth.uid() where id = p_id returning * into d;
  if d.auteur is not null then
    insert into public.notifications (destinataire, espace, type, niveau, titre, texte, reference)
    values (d.auteur, coalesce(nullif(d.espace, 'visiteur'), 'client'), 'info', 'important', 'Réponse du support', left(coalesce(p_reponse, ''), 300), d.reference);
  end if;
end $$;
revoke execute on function public.repondre_support(uuid, text, text) from public, anon;
grant execute on function public.repondre_support(uuid, text, text) to authenticated;

-- Appliqués aussi le 20/11/2026 (voir migrations Supabase du même nom) :
--  * support_email_envoye_2011 : demandes_support.email_envoye_le (un seul e-mail par demande, fonction « support »).
--  * annulation_sans_avoir_2011 : annuler_sans_remplacant n'offre plus d'avoir de 15 € (rien à la charge de Cleaneroo).
--  * dossier_assurance_2011 : dossier_assurance(reference, jeton) → parties, prestation, dommages et photos avant / après.
--  * piscine_activite_rc_2011 : activite_rc_pro('pool') = 'exterieurs'.
