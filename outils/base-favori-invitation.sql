-- Prochain passage réservé aux prestations récurrentes + invitation « Cleaneur favori » (25/11/2026, validé par Michael : « oui applique »).
-- Même logique à reporter dans les applis (Vincent).
--
-- 1. Le prochain passage ne se propose que pour les prestations qui reviennent à un rythme choisi par le client
--    (ménage du logement, vitres, bureaux, commerces, parties communes, véhicules, extérieurs, piscine, textiles).
--    Pas pour la location saisonnière ni l'hôtellerie : elles suivent le calendrier des réservations.
-- 2. Pour les autres prestations (location saisonnière comprise), le Cleaneur peut inviter le client à le mettre en favori,
--    une seule fois par client. Le client est prévenu ; sur sa prestation, « Ajouter à mes favoris » est mis en avant.
--    Quand le client l'ajoute, le Cleaneur en est prévenu.

/* ---------------------------------------------------------------- 1. Prochain passage : prestations récurrentes seulement */
create or replace function public.proposer_prochain_passage(p_reference text, p_jour date, p_heure integer) returns text
 language plpgsql security definer set search_path = '' as $$
declare d public.demandes; prenom text;
begin
  select * into d from public.demandes where reference = p_reference;
  if not found or auth.uid() is null or d.cleaneur_id is distinct from auth.uid() then return 'interdit'; end if;
  if d.rubrique_id not in ('home', 'windows', 'office', 'commerce', 'communal', 'car', 'outdoor', 'pool', 'textiles') then return 'prestation'; end if;
  if d.statut not in ('A_VALIDER', 'TERMINEE') or d.client_id is null then return 'impossible'; end if;
  if p_jour < current_date + 1 or p_jour > current_date + 90 or p_heure < 7 or p_heure > 18 then return 'date'; end if;
  if exists (select 1 from public.propositions_passage x where x.reference = p_reference and x.statut = 'PROPOSEE') then return 'deja'; end if;
  insert into public.propositions_passage (reference, cleaneur_id, client_id, jour, heure) values (p_reference, auth.uid(), d.client_id, p_jour, p_heure);
  select p.prenom into prenom from public.profils p where p.id = auth.uid();
  perform public.notifier(d.client_id, 'client', 'info', 'important', 'Votre Cleaneur vous propose un prochain passage',
    coalesce(prenom, 'Votre Cleaneur') || ' peut revenir le ' || to_char(p_jour, 'DD/MM/YYYY') || ' à ' || p_heure || ' h. Réservez en un geste depuis la prestation.', p_reference);
  return 'ok';
end $$;

/* ---------------------------------------------------------------- 2. Invitation « Cleaneur favori » */
create table if not exists public.invitations_favori (
  id uuid primary key default gen_random_uuid(),
  reference text not null,                 -- mission d'où part l'invitation
  cleaneur_id uuid not null,
  client_id uuid not null,
  statut text not null default 'ENVOYEE' check (statut in ('ENVOYEE', 'ACCEPTEE')),
  cree_le timestamptz not null default now(),
  unique (cleaneur_id, client_id)          -- une seule invitation par client
);
alter table public.invitations_favori enable row level security;   -- accès seulement par les fonctions ci-dessous

create or replace function public.inviter_favori(p_reference text) returns text
 language plpgsql security definer set search_path = '' as $$
declare d public.demandes; prenom text;
begin
  select * into d from public.demandes where reference = p_reference;
  if not found or auth.uid() is null or d.cleaneur_id is distinct from auth.uid() then return 'interdit'; end if;
  if d.statut not in ('A_VALIDER', 'TERMINEE') or d.client_id is null then return 'impossible'; end if;
  if exists (select 1 from public.favoris f where f.client_id = d.client_id and f.cleaneur_id = auth.uid()) then return 'deja_favori'; end if;
  if exists (select 1 from public.invitations_favori i where i.client_id = d.client_id and i.cleaneur_id = auth.uid()) then return 'deja'; end if;
  insert into public.invitations_favori (reference, cleaneur_id, client_id) values (p_reference, auth.uid(), d.client_id);
  select p.prenom into prenom from public.profils p where p.id = auth.uid();
  perform public.notifier(d.client_id, 'client', 'info', 'standard', 'Votre Cleaneur vous invite à le garder en favori',
    coalesce(prenom, 'Votre Cleaneur') || ' aimerait revenir chez vous. En favori, ce Cleaneur voit vos prochaines demandes en premier. Vous pouvez l''ajouter depuis la prestation.', p_reference);
  return 'ok';
end $$;

-- Côté client connecté : le Cleaneur de cette prestation l'a-t-il invité (et n'est pas encore en favori) ?
create or replace function public.invitation_favori(p_reference text) returns text
 language sql stable security definer set search_path = '' as $$
  select p.prenom from public.demandes d
  join public.invitations_favori i on i.cleaneur_id = d.cleaneur_id and i.client_id = d.client_id and i.statut = 'ENVOYEE'
  join public.profils p on p.id = d.cleaneur_id
  where d.reference = p_reference and d.client_id = auth.uid()
    and not exists (select 1 from public.favoris f where f.client_id = d.client_id and f.cleaneur_id = d.cleaneur_id)
  limit 1;
$$;

-- Côté Cleaneur : ses invitations (référence de départ, et si le client l'a ajouté depuis).
create or replace function public.mes_invitations_favori()
 returns table(reference text, client_reference text, statut text) language sql stable security definer set search_path = '' as $$
  -- client_reference : toutes les prestations de ce client avec ce Cleaneur, pour savoir sur quelles missions l'invitation est déjà faite
  select i.reference, d.reference, case when exists (select 1 from public.favoris f where f.client_id = i.client_id and f.cleaneur_id = i.cleaneur_id) then 'ACCEPTEE' else i.statut end
  from public.invitations_favori i join public.demandes d on d.client_id = i.client_id and d.cleaneur_id = i.cleaneur_id
  where i.cleaneur_id = auth.uid();
$$;

-- Le client ajoute le Cleaneur en favori : l'invitation est acceptée et le Cleaneur prévenu.
create or replace function public.favori_accepte() returns trigger language plpgsql security definer set search_path = '' as $$
declare r text;
begin
  update public.invitations_favori set statut = 'ACCEPTEE' where client_id = new.client_id and cleaneur_id = new.cleaneur_id and statut = 'ENVOYEE' returning reference into r;
  if r is not null then
    perform public.notifier(new.cleaneur_id, 'cleaneur', 'info', 'standard', 'Vous êtes Cleaneur favori',
      'Votre client vous a ajouté à ses favoris : vous verrez ses prochaines demandes en premier.', r);
  end if;
  return new;
end $$;
drop trigger if exists favoris_invitation on public.favoris;
create trigger favoris_invitation after insert on public.favoris for each row execute function public.favori_accepte();

revoke all on function public.inviter_favori(text) from public, anon;
revoke all on function public.invitation_favori(text) from public, anon;
revoke all on function public.mes_invitations_favori() from public, anon;
revoke all on function public.favori_accepte() from public, anon, authenticated;
grant execute on function public.inviter_favori(text) to authenticated;
grant execute on function public.invitation_favori(text) to authenticated;
grant execute on function public.mes_invitations_favori() to authenticated;
