-- « Invitez vos propres Cleaneurs » (11 novembre 2026, repris de l'appli iPhone de Vincent : Invitations.swift).
-- Une conciergerie (espace Pro) amène ses intervenants habituels. Aucune dispense de vérification : l'invité suit
-- le dossier complet ; une fois son dossier validé, il devient Cleaneur attitré de la conciergerie et voit ses
-- missions tout de suite (même en formule Gratuit). Commission : taux normal de sa formule.
-- Code de 6 caractères sans 0, O, 1 ni I ; une invitation non utilisée expire au bout de 30 jours (« Relancer »).

create table if not exists public.invitations_pro (
  id uuid primary key default gen_random_uuid(),
  envoyee_le timestamptz not null default now(),
  pro_id uuid not null references auth.users(id) on delete cascade,
  societe text not null,
  prenom text not null check (char_length(prenom) between 1 and 60),
  nom text not null default '' check (char_length(nom) <= 60),
  contact text not null default '' check (char_length(contact) <= 120),
  code text not null unique check (code ~ '^[A-HJ-NP-Z2-9]{6}$'),
  statut text not null default 'ENVOYEE' check (statut in ('ENVOYEE', 'DOSSIER', 'ACTIF')),
  cleaneur_id uuid references auth.users(id) on delete set null,
  inscrit_le timestamptz,
  active_le timestamptz,
  relances int not null default 0
);
alter table public.invitations_pro enable row level security;
drop policy if exists invitations_lecture on public.invitations_pro;
create policy invitations_lecture on public.invitations_pro for select
  using (pro_id = auth.uid() or cleaneur_id = auth.uid() or public.est_admin());
create index if not exists invitations_cleaneur on public.invitations_pro (cleaneur_id) where statut = 'ACTIF';

-- Nouvelle invitation : renvoie le code.
create or replace function public.creer_invitation(p_prenom text, p_nom text, p_contact text)
returns text language plpgsql security definer set search_path to '' as $$
declare v_code text; v_societe text; a text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  if coalesce(trim(p_prenom), '') = '' then raise exception 'Prénom obligatoire'; end if;
  select coalesce(nullif(trim(p.societe), ''), trim(coalesce(p.prenom, '') || ' ' || coalesce(p.nom, ''))) into v_societe
    from public.profils p where p.id = auth.uid();
  if (select count(*) from public.invitations_pro i where i.pro_id = auth.uid() and i.envoyee_le > now() - interval '1 day') >= 30 then
    raise exception 'Trop d''invitations aujourd''hui';
  end if;
  loop
    v_code := (select string_agg(substr(a, 1 + floor(random() * 32)::int, 1), '') from generate_series(1, 6));
    exit when not exists (select 1 from public.invitations_pro i where i.code = v_code);
  end loop;
  insert into public.invitations_pro (pro_id, societe, prenom, nom, contact, code)
  values (auth.uid(), coalesce(nullif(v_societe, ''), 'Votre conciergerie'), trim(p_prenom), coalesce(trim(p_nom), ''), coalesce(trim(p_contact), ''), v_code);
  return v_code;
end $$;
grant execute on function public.creer_invitation(text, text, text) to authenticated;

-- Relance : 30 jours de plus, même code.
create or replace function public.relancer_invitation(p_id uuid) returns void language sql security definer set search_path to '' as $$
  update public.invitations_pro set envoyee_le = now(), relances = relances + 1
   where id = p_id and pro_id = auth.uid() and statut <> 'ACTIF';
$$;
grant execute on function public.relancer_invitation(uuid) to authenticated;

-- Le Cleaneur saisit son code : "introuvable", "expiree", "deja", "soi_meme", "ok_dossier" (actif à la validation) ou "ok_actif".
create or replace function public.utiliser_invitation(p_code text) returns text language plpgsql security definer set search_path to '' as $$
declare i public.invitations_pro; v_code text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g')); v_valide boolean;
begin
  if auth.uid() is null then return 'introuvable'; end if;
  select * into i from public.invitations_pro x where x.code = v_code;
  if not found then return 'introuvable'; end if;
  if i.pro_id = auth.uid() then return 'soi_meme'; end if;
  if i.statut = 'ACTIF' then return case when i.cleaneur_id = auth.uid() then 'ok_actif' else 'deja' end; end if;
  if i.cleaneur_id is not null and i.cleaneur_id <> auth.uid() then return 'deja'; end if;
  if i.envoyee_le < now() - interval '30 days' then return 'expiree'; end if;
  select p.dossier = 'VALIDE' and p.banni_le is null into v_valide from public.profils p where p.id = auth.uid();
  update public.invitations_pro set cleaneur_id = auth.uid(), inscrit_le = coalesce(inscrit_le, now()),
    statut = case when coalesce(v_valide, false) then 'ACTIF' else 'DOSSIER' end,
    active_le = case when coalesce(v_valide, false) then now() else null end
   where id = i.id;
  return case when coalesce(v_valide, false) then 'ok_actif' else 'ok_dossier' end;
end $$;
grant execute on function public.utiliser_invitation(text) to authenticated;

-- Dossier validé : les invitations en attente de ce Cleaneur deviennent actives.
create or replace function public.activer_invitations() returns trigger language plpgsql security definer set search_path to '' as $$
begin
  if new.dossier = 'VALIDE' and new.banni_le is null then
    update public.invitations_pro set statut = 'ACTIF', active_le = now() where cleaneur_id = new.id and statut = 'DOSSIER';
  end if;
  return new;
end $$;
drop trigger if exists activer_invitations on public.profils;
create trigger activer_invitations after update of dossier, banni_le on public.profils for each row execute function public.activer_invitations();

-- Missions visibles : en plus des règles existantes, le Cleaneur attitré voit tout de suite les missions de sa conciergerie.
create or replace function public.mission_visible(d public.demandes) returns boolean language sql stable security definer set search_path to '' as $$
  select public.est_admin() or public.formule_effective(auth.uid()) = 'pro'
    or (coalesce(d.espace, 'personnel') = 'personnel' and (d.urgence or d.cree_le <= now() - interval '30 minutes'))
    or exists (select 1 from public.invitations_pro i where i.statut = 'ACTIF' and i.cleaneur_id = auth.uid() and i.pro_id = d.client_id);
$$;
