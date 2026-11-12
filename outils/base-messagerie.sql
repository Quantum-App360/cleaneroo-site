-- Messagerie (12 novembre 2026, reprise de l'appli iPhone de Vincent) : une conversation par prestation entre le client et
-- son Cleaneur (ouverte dès que la mission est confirmée), plus une conversation « Cleaneroo · Support » par personne.
-- Photos jointes (stockage privé « messages »). Chaque message envoie une notification à l'autre partie.
-- fil : la référence de la prestation (CLN-…) ou « support:<id du compte> ».

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  fil text not null check (char_length(fil) <= 60),
  auteur uuid references auth.users(id) on delete set null,
  role text not null check (role in ('client', 'cleaneur', 'support')),
  texte text not null default '' check (char_length(texte) <= 2000),
  photo text not null default '' check (char_length(photo) <= 300),
  lu boolean not null default false,
  cree_le timestamptz not null default now(),
  check (texte <> '' or photo <> ''));
alter table public.messages enable row level security;   -- lecture et écriture par les fonctions ci-dessous seulement
create index if not exists messages_fil_idx on public.messages (fil, cree_le);
revoke all on public.messages from anon, authenticated;

-- Rôle de la personne connectée dans un fil (null = pas d'accès).
create or replace function public.role_dans_fil(p_fil text) returns text language sql stable security definer set search_path to '' as $$
  select case
    when p_fil = 'support:' || auth.uid()::text then 'client'
    when p_fil like 'support:%' and public.est_admin() then 'support'
    when exists (select 1 from public.demandes d where d.reference = p_fil and d.client_id = auth.uid() and d.cleaneur_id is not null) then 'client'
    when exists (select 1 from public.demandes d where d.reference = p_fil and d.cleaneur_id = auth.uid()) then 'cleaneur'
    when public.est_admin() and exists (select 1 from public.demandes d where d.reference = p_fil) then 'support'
  end;
$$;

create or replace function public.messages_du_fil(p_fil text) returns table(id uuid, role text, texte text, photo text, cree_le timestamptz, de_moi boolean)
language plpgsql security definer set search_path to '' as $$
declare r text := public.role_dans_fil(p_fil);
begin
  if r is null then return; end if;
  -- Ouvrir le fil marque comme lus les messages des autres.
  update public.messages m set lu = true where m.fil = p_fil and m.role <> r and not m.lu;
  return query select m.id, m.role, m.texte, m.photo, m.cree_le, m.auteur = auth.uid() from public.messages m where m.fil = p_fil order by m.cree_le limit 500;
end $$;

create or replace function public.envoyer_message(p_fil text, p_texte text, p_photo text default '') returns text
language plpgsql security definer set search_path to '' as $$
declare r text := public.role_dans_fil(p_fil); d public.demandes; dest uuid; espace text;
begin
  if r is null then return 'interdit'; end if;
  if coalesce(trim(p_texte), '') = '' and coalesce(p_photo, '') = '' then return 'vide'; end if;
  if coalesce(p_photo, '') <> '' and p_photo not like replace(p_fil, ':', '-') || '/%' then return 'invalide'; end if;
  insert into public.messages (fil, auteur, role, texte, photo) values (p_fil, auth.uid(), r, left(trim(coalesce(p_texte, '')), 2000), coalesce(p_photo, ''));
  -- Notification à l'autre partie.
  if p_fil like 'support:%' then
    if r = 'support' then dest := substr(p_fil, 9)::uuid; espace := 'client'; end if;
  else
    select * into d from public.demandes where reference = p_fil;
    if r = 'client' then dest := d.cleaneur_id; espace := 'cleaneur';
    elsif r = 'cleaneur' then dest := d.client_id; espace := 'client';
    else dest := d.client_id; espace := 'client'; end if;
  end if;
  if dest is not null and not exists (select 1 from public.notifications n where n.destinataire = dest and n.reference = p_fil
      and n.titre = 'Nouveau message' and not n.lu) then
    perform public.notifier(dest, espace, 'info', 'important', 'Nouveau message', left(coalesce(nullif(trim(p_texte), ''), '📷'), 120), p_fil);
  end if;
  return 'ok';
end $$;

-- Conversations de la personne connectée : prestations confirmées (client ou Cleaneur) + support.
create or replace function public.mes_conversations() returns table(fil text, rubrique_id text, ville text, avec text, dernier text, dernier_le timestamptz, non_lus integer)
language sql stable security definer set search_path to '' as $$
  with fils as (
    select d.reference as fil, d.rubrique_id, d.ville, coalesce(p.prenom, '') as avec, 'client' as moi
      from public.demandes d left join public.profils p on p.id = d.cleaneur_id
      where d.client_id = auth.uid() and d.cleaneur_id is not null and d.statut <> 'ANNULEE'
    union all
    select d.reference, d.rubrique_id, d.ville, d.prenom, 'cleaneur'
      from public.demandes d where d.cleaneur_id = auth.uid() and d.statut <> 'ANNULEE'
    union all
    select 'support:' || auth.uid()::text, null, null, 'Cleaneroo · Support', 'client' where auth.uid() is not null)
  select f.fil, f.rubrique_id, f.ville, f.avec,
    (select coalesce(nullif(m.texte, ''), '📷') from public.messages m where m.fil = f.fil order by m.cree_le desc limit 1),
    (select max(m.cree_le) from public.messages m where m.fil = f.fil),
    (select count(*)::int from public.messages m where m.fil = f.fil and m.role <> f.moi and not m.lu)
  from fils f
  order by 6 desc nulls last;
$$;

-- Support : fils ouverts, pour l'administration.
create or replace function public.fils_support() returns table(fil text, prenom text, nom text, dernier text, dernier_le timestamptz, non_lus integer)
language sql stable security definer set search_path to '' as $$
  select m.fil, p.prenom, p.nom, (array_agg(coalesce(nullif(m.texte, ''), '📷') order by m.cree_le desc))[1], max(m.cree_le),
    count(*) filter (where m.role <> 'support' and not m.lu)::int
  from public.messages m left join public.profils p on p.id::text = substr(m.fil, 9)
  where public.est_admin() and m.fil like 'support:%' group by m.fil, p.prenom, p.nom order by 5 desc;
$$;

revoke execute on function public.role_dans_fil(text) from anon, public, authenticated;
revoke execute on function public.messages_du_fil(text) from anon, public;
revoke execute on function public.envoyer_message(text, text, text) from anon, public;
revoke execute on function public.mes_conversations() from anon, public;
revoke execute on function public.fils_support() from anon, public;
grant execute on function public.messages_du_fil(text) to authenticated;
grant execute on function public.envoyer_message(text, text, text) to authenticated;
grant execute on function public.mes_conversations() to authenticated;
grant execute on function public.fils_support() to authenticated;

-- Photos des messages : stockage privé, dossier = fil (« support-<id> » pour le support) ; lecture et dépôt réservés aux personnes du fil.
create or replace function public.peut_voir_fil(p_fil text) returns boolean language sql stable security definer set search_path to '' as $$
  select public.role_dans_fil(p_fil) is not null;
$$;
grant execute on function public.peut_voir_fil(text) to authenticated;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('messages', 'messages', false, 5242880, array['image/jpeg', 'image/png', 'image/webp']) on conflict (id) do nothing;
drop policy if exists "messages : déposer dans ses fils" on storage.objects;
create policy "messages : déposer dans ses fils" on storage.objects for insert to authenticated
  with check (bucket_id = 'messages' and public.peut_voir_fil(replace((storage.foldername(name))[1], 'support-', 'support:')));
drop policy if exists "messages : lire ses fils" on storage.objects;
create policy "messages : lire ses fils" on storage.objects for select to authenticated
  using (bucket_id = 'messages' and public.peut_voir_fil(replace((storage.foldername(name))[1], 'support-', 'support:')));
